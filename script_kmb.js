"use strict";
const kmb_api_base = "https://data.etabus.gov.hk/v1/transport/kmb";
let kmb_route_eta;
let kmb_stop_eta;
let kmb_route_data;
let kmb_stop_data;
let kmb_route_stop_data;
let kmb_stop_name_data;
let kmb_route_terminus_data = {};
let kmb_route_eta_refresh;
let kmb_stop_eta_refresh;
async function kmb_setup() {
    try {
        [kmb_route_data, kmb_stop_data, kmb_route_stop_data, kmb_stop_name_data] = await Promise.all([
            kmb_local_storage_item("kmb_route_data", `${kmb_api_base}/route`, 7),
            kmb_local_storage_item("kmb_stop_data", `${kmb_api_base}/stop`, 7),
            kmb_local_storage_item("kmb_route_stop_data", `${kmb_api_base}/route-stop`, 7),
            kmb_local_storage_item("kmb_stop_name_data", "https://gopstnm.github.io/etalive/data/kmb_name_data.json", 7)
        ]);
        console.log("Setup data completed.");
        prepare_name_replacements();
        prepare_get_stop_data();
    } catch (error) {
        console.log("Setup data failed.");
        alert("An error occured. Please reload the page.");
    }
}
async function kmb_setup_eta_page() {
    await kmb_setup();
    const url_params = new URLSearchParams(window.location.search);
    if (url_params.has("r")) {
        document.getElementById("rte_input").value = url_params.get("r");
    }
    kmb_rte_input_change();
    if (url_params.has("d")) {
        document.getElementById("rte_options_select").value = url_params.get("d");
        kmb_update();
    }
}
async function kmb_local_storage_item(label, url, validity_period) {
    const max_fetch_attempt = 10;
    let data_dictionary = {};
    let return_data;
    if (localStorage.getItem("kmb_data_dictionary")) {
        data_dictionary = JSON.parse(localStorage.getItem("kmb_data_dictionary"));
    }
    if (data_dictionary[label] && localStorage.getItem(label) && (Date.now() - data_dictionary[label]) < (validity_period * 86400000)) {
        return_data = JSON.parse(localStorage.getItem(label));
    } else {
        let error;
        for (let i = 0; i < max_fetch_attempt; i++){
            try {
                return_data = await fetch(url).then(r => r.ok ? r.json() : Promise.reject(r));
                error = null;
                break;
            } catch (e) {
                error = e;
                if (i < max_fetch_attempt - 1) await new Promise(r => setTimeout(r, 1000));
            }
        }
        if (error) throw error;
        localStorage.setItem(label, JSON.stringify(return_data));
        data_dictionary[label] = Date.now();
        localStorage.setItem("kmb_data_dictionary", JSON.stringify(data_dictionary))
    }
    return return_data;
}
function prepare_name_replacements() {
    const name_word_replacements_en = kmb_stop_name_data["replacements_en"];
    const name_escaped_keys_en = Object.keys(name_word_replacements_en).map(key => key.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
    const name_replacements_regex_en = new RegExp(`(?<=^|[\\s()\\-])(${name_escaped_keys_en.join("|")})(?=[\\s()\\-']|$)`, "gi");
    const name_word_replacements_tc = kmb_stop_name_data["replacements_tc"];
    const name_escaped_keys_tc = Object.keys(name_word_replacements_tc).map(key => key.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
    const name_replacements_regex_tc = new RegExp(`(${name_escaped_keys_tc.join("|")})`, "gi");
    const name_pole_id_regex = /\s\(([A-Z]{2}\d{3}[A-Z]?)\)$/i;
    const name_title_case_regex = /(?<=^|[\s\-()\/\\.])[a-z]/g;
    window.proper_stop_name_en = function(name) {
        const stop_name = name.replace(name_pole_id_regex, "").trim().replace(/(?<!\s)\(/g, " (").replace(/,(?!\s)/g, ", ");
        let proper_stop_name = stop_name.toLowerCase().replace(name_title_case_regex, (txt) => {
            return txt.toUpperCase();
        });
        return proper_stop_name.replace(name_replacements_regex_en, (matched) => {
            const name_replace_key = Object.keys(name_word_replacements_en).find(
                key => key.toLowerCase() === matched.toLowerCase()
            );
            return name_word_replacements_en[name_replace_key] || matched;
        });
    }
    window.proper_stop_name_tc = function(name) {
        const stop_name = name.replace(name_pole_id_regex, "").trim().replace(/,(?!\s)/g, ", ");
        let proper_stop_name = stop_name.toLowerCase().replace(name_title_case_regex, (txt) => {
            return txt.toUpperCase();
        });
        return proper_stop_name.replace(name_replacements_regex_tc, (matched) => {
            const name_replace_key = Object.keys(name_word_replacements_tc).find(
                key => key.toLowerCase() === matched.toLowerCase()
            );
            return name_word_replacements_tc[name_replace_key] || matched;
        });
    }
    window.proper_stop_name_id = function(name) {
        const pole_id = name.match(name_pole_id_regex);
        return pole_id ? pole_id[1] : "";
    }
}
function kmb_rte_input_change() {
    const rte_input = document.getElementById("rte_input").value;
    const rte_options_select = document.getElementById("rte_options_select");
    document.getElementById("rte_input").value = rte_input.toUpperCase();
    if (!kmb_route_data) {
        return;
    }
    rte_options_select.innerHTML = "<option value='' selected disabled>Select Direction</option>";
    let rte_first = true;
    for (const rte_data of kmb_route_data["data"]) {
        if (rte_data["route"] == rte_input.toUpperCase()) {
            let rte_str = `${proper_stop_name_en(rte_data["orig_en"])} to ${proper_stop_name_en(rte_data["dest_en"])}`
            if (rte_data["service_type"] != 1) {
                rte_str += ` [Spec Dep ${rte_data["service_type"]}]`
            }
            rte_options_select.append(new Option(rte_str, `${rte_data["bound"]}${rte_data["service_type"]}`, false, rte_first));
            rte_first = false;
        }
    }
}
function prepare_get_stop_data() {
    let replaced_stop_data = {};
    window.get_stop_data = function(stop_id) {
        if (replaced_stop_data[stop_id]) {
            return replaced_stop_data[stop_id];
        }
        let curr_stop_data = kmb_stop_data["data"].find(data => data["stop"] === stop_id);
        if (!curr_stop_data) {
            return ["Name Unavailable", "Name Unavailable", "", NaN, NaN];
        }
        let return_data = [proper_stop_name_en(curr_stop_data["name_en"]), proper_stop_name_tc(curr_stop_data["name_tc"]), proper_stop_name_id(curr_stop_data["name_en"]), curr_stop_data["lat"], curr_stop_data["long"]];
        replaced_stop_data[stop_id] = return_data;
        return return_data;
    }
}
async function kmb_update() {
    if (!document.getElementById("rte_options_select").value) {
        document.getElementById("message_text_area").innerHTML = "Invalid route or direction, please input again.";
        return;
    }
    document.getElementById("message_text_area").innerHTML = "Please wait";
    try {
        const rte_options_select = document.getElementById("rte_options_select");
        const bound = rte_options_select.value[0];
        const service_type = rte_options_select.value[1];
        const route = document.getElementById("rte_input").value.toUpperCase();
        const eta_data = await (await fetch(`${kmb_api_base}/route-eta/${route}/${service_type}`)).json();
        let eta_list = {};
        for (const i of eta_data["data"]) {
            if (i["dir"] == bound) {
                if (!eta_list[Number(i["seq"])-1]) {
                    eta_list[Number(i["seq"])-1] = [];
                }
                eta_list[Number(i["seq"])-1].push([i["eta"], i["rmk_en"]]);
            }
        }
        kmb_route_eta = eta_list;
        kmb_to_display();
    } catch (error) {
        console.log(error);
        document.getElementById("message_text_area").innerHTML = "An error occurred, please reload and try again.";
        localStorage.removeItem("kmb_data_dictionary");
    }
}
async function kmb_to_display() {
    const rte_options_select = document.getElementById("rte_options_select");
    const bound = rte_options_select.value[0];
    const service_type = rte_options_select.value[1];
    const route = document.getElementById("rte_input").value.toUpperCase();
    const stop_list = kmb_route_stop_data["data"].filter(data => data["route"] == route).filter(data => data["bound"] == bound && data["service_type"] == service_type);
    let stop_names = [];
    for (const i of stop_list) {
        stop_names[i["seq"] - 1] = get_stop_data(i["stop"]);
    }
    let results = "";
    for (const [seq, data] of Object.entries(kmb_route_eta)) {
        results += `<div id="stop_disp_${seq}" class="list_display_stop">`;
        let circ_colour = "y";
        if (!data[0][0]) {
            circ_colour = "g";
        }
        results += `<div class='circle_${circ_colour}' onclick='kmb_stop_update(["${stop_list[seq]["stop"]}"]);'></div>`;
        results += `<div onclick='kmb_stop_click(${seq});'>`;
        results += `<p class='list_display_stop_name'><span class='text_bold'>${seq}</span> ${stop_names[seq][0]} <span class='text_name_details'>${stop_names[seq][2]}</span></p>`;
        results += "</div>";
        results += "</div>";
    }
    document.getElementById("message_text_area").innerHTML = "";
    document.getElementById("results").innerHTML = results;
}
function kmb_stop_click(i) {
    if (document.getElementById(`stop_table_${i}`)) {
        document.getElementById(`stop_table_${i}`).remove();
        return;
    }
    let results = "";
    if (kmb_route_eta[i]) {
        results += `<table class='eta_table' id='stop_table_${i}'>`;
        for (const k of kmb_route_eta[i]) {
            const eta_time = k[0];
            let time_str = "";
            let mins_str = "";
            let rmk_str = "";
            if (eta_time) {
                time_str = time_show_format(eta_time);
                const eta_time_mins = time_difference_format(eta_time);
                if (i == 0 || i == Object.keys(kmb_route_eta).length - 1) {
                    mins_str = `<span class="text_bold">${eta_time_mins}</span> <span class="text_small">min</span>`;
                } else if (eta_time_mins < -0.5) {
                    mins_str = "<span class='text_bold'>Departed</span>";
                } else if (eta_time_mins < 0) {
                    mins_str = "<span class='text_bold'>Departing</span>";
                } else if (eta_time_mins < 0.5) {
                    mins_str = "<span class='text_bold'>Arriving</span>";
                } else {
                    mins_str = `<span class="text_bold">${eta_time_mins}</span> <span class="text_small">min</span>`;
                }
                if (k[1]) {
                    rmk_str += `<span class='text_medium'>${k[1]}</span>`;
                }
            }
            results += "<tr>";
            results += `<td style="width: 105px;">${time_str}</td>`;
            results += `<td style="width: 85px;">${mins_str}</td>`;
            results += `<td style="width: max-content;">${rmk_str}</td>`;
            results += "</tr>";
        }
        results += "</table>";
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(results, "text/html");
    document.getElementById("stop_disp_" + i).after(...doc.body.children);
    function time_show_format(t) {
        return new Date(t).toTimeString().slice(0, 8);
    }
    function time_difference_format(t) {
        return Math.round((new Date(t) - new Date()) / 6000) / 10;
    }
}
async function kmb_find_terminus_index(route, bound, service_type) {
    const object_key = `${route}/${bound}/${service_type}`;
    if (kmb_route_terminus_data[object_key]) {
        return kmb_route_terminus_data[object_key];
    } else {
        const stop_data_url = `${kmb_api_base}/route-stop/${route}/${bound == "I" ? "inbound" : "outbound"}/${service_type}`;
        const stop_data = await kmb_local_storage_item(`kmb_rte_stop_list/${route}/${bound}/${service_type}`, stop_data_url, 7);
        const seq_values = stop_data["data"].map(item => item["seq"]);
        const terminus_index = Math.max(...seq_values);
        kmb_route_terminus_data[object_key] = terminus_index;
        return terminus_index;
    }
}
function kmb_window_disp_click(e) {
    const wrapper = document.querySelector(".window_disp_elem");
    if (!wrapper.contains(e.target)) {
        kmb_show_stop_dialog(false);
    }
}
function kmb_show_stop_dialog(show) {
    const stop_dialog = document.getElementById("stop_eta_disp");
    if (show) {
        stop_dialog.showModal();
    } else {
        stop_dialog.close();
    }
}
//WIP
async function kmb_stop_update(stop_id) {
    let dialog_results = "";
    const stop_name_data = get_stop_data(stop_id);
    const stop_name = [stop_id, stop_name_data];
    dialog_results += `<span class='title_inline_block'>${stop_name[1][0]}</span> `;
    dialog_results += `<span class='title_inline_block'>${stop_name[1][1]}</span> `;
    dialog_results += `<span class='title_inline_block text_desc'>${stop_name[1][2]}</span>`;
    document.getElementById("stop_eta_disp_title").innerHTML = dialog_results;
    document.getElementById("stop_eta_disp_eta").replaceChildren();
    document.getElementById("stop_eta_disp_eta").innerHTML = "<p class='text_bold'>Please wait</p>";
    kmb_show_stop_dialog(true);
    const stop_eta_data = await stop_eta_fetch(stop_id);
    stop_eta_display(stop_id, sort_stop_eta_data(stop_eta_data));
}
async function stop_eta_fetch(stop_id) {
    const stop_eta_fetch_data = await (await fetch(`${kmb_api_base}/stop-eta/${stop_id}`)).json();
    let stop_eta_data = {};
    for (const i of stop_eta_fetch_data["data"]) {
        const rte = i["route"];
        const dir = i["dir"];
        const rte_dir = `${rte}/${dir}`;
        const seq = i["seq"];
        const st = i["service_type"];
        const st_seq = `${st}/${seq}`;
        let dest = proper_stop_name_en(i["dest_en"]);
        let sort_index = 1;
        try {
            if (seq === await find_terminus_index(rte, dir, st)) {
                dest = "Terminates Here"
            } else {
                sort_index = 0;
            }
        } catch (erroror) {
            console.log(erroror);
        }
        if (!i["eta"]) {
            if (i["rmk_en"]) {
                sort_index = 2;
            } else {
                sort_index = 3;
            }
        }
        if (!stop_eta_data[rte_dir]) {
            stop_eta_data[rte_dir] = {
                "eta_service_type": st,
                "st_seq": [],
                "data": {
                    [seq]: {
                        "dest": [dest],
                        "eta": [],
                        "sort": sort_index
                    }
                }
            };
        } else if (!stop_eta_data[rte_dir]["data"][seq] && st === stop_eta_data[rte_dir]["eta_service_type"]) {
            stop_eta_data[rte_dir]["data"][seq] = {"dest": [dest], "eta": [], "sort": sort_index};
        }
        if (st === stop_eta_data[rte_dir]["eta_service_type"]) {
            stop_eta_data[rte_dir]["data"][seq]["eta"].push([i["eta"], i["rmk_en"], i["rmk_tc"]]);
        } else {
            if (!stop_eta_data[rte_dir]["st_seq"].includes(st_seq) && dest != "Terminates Here") {
                curr_loop: for (const [key, value] of Object.entries(stop_eta_data[rte_dir]["data"])) {
                    if (!value["dest"].includes(dest)) {
                        value["dest"].push(dest);
                        break curr_loop;
                    }
                }
            } else if (!stop_eta_data[rte_dir]["st_seq"].includes(st_seq)) {
                curr_loop: for (const [key, value] of Object.entries(stop_eta_data[rte_dir]["data"]).reverse()) {
                    if (!value["dest"].includes(dest)) {
                        value["dest"].push(dest);
                        break curr_loop;
                    } else {
                        break curr_loop;
                    }
                }
            }
        }
        if (stop_eta_data[rte_dir]["data"][seq] && sort_index < stop_eta_data[rte_dir]["data"][seq]["sort"]) {
            stop_eta_data[rte_dir]["data"][seq]["sort"] = sort_index;
        }
        if (!stop_eta_data[rte_dir]["st_seq"].includes(st_seq)) {
            stop_eta_data[rte_dir]["st_seq"].push(st_seq);
        }
    }
    return stop_eta_data;
}
function sort_stop_eta_data(eta_data) {
    const stop_eta_data_sorted = Object.entries(eta_data).flatMap(([rte_dir, data]) =>
        Object.entries(data["data"] || {}).map(([stop_seq, stop_data]) =>
            [rte_dir, stop_seq, stop_data["dest"], stop_data["eta"], stop_data["sort"]]
        )
    ).sort((a, b) => a[4] - b[4]);
    return stop_eta_data_sorted;
}
function stop_eta_display(stop_id, stop_eta_data) {
    console.log(stop_eta_data);
    let results = "<table class='eta_data'>";
    for (const i of stop_eta_data) {
        const sub_data = i[0].split("/");
        const dest_string = i[2].join("/ ");
        let rte_dest_table = `${sub_data[0]} <span class="text_medium title_inline_block">${dest_string}</span>`
        const display_type = i[4];
        if (display_type === 0 || display_type === 1) {
            let eta_disp_content = "";
            for (const k of i[3]) {
                const eta_time = k[0];
                const eta_time_mins = time_difference_format(eta_time);
                const time_data = `<span class="text_bold">${eta_time_mins}</span> <span class="text_small">min</span>`;
                eta_disp_content += `<td style="width: calc(50% / 3); max-width: 300px; min-width: 65px">${time_data}</td>`;
            }
            results += `<tr><td style="width: 50%; max-width: 250px;">${rte_dest_table}</td>${eta_disp_content}</tr>`;
        } else if (display_type === 2) {
            results += `<tr><td>${rte_dest_table}</td><td colspan="3">${i[3][0][1]}</td></tr>`;
        } else {
            results += `<tr><td>${rte_dest_table}</td><td colspan="3">No Service</td></tr>`;
        }
    }
    results += "</table>";
    const parser = new DOMParser();
    const doc = parser.parseFromString(results, "text/html");
    document.getElementById("stop_eta_disp_eta").replaceChildren(doc.body.firstChild);
}
function time_show_format(t) {
    return new Date(t).toTimeString().slice(0, 8);
}
function time_difference_format(t) {
    return Math.round((new Date(t) - new Date())/60000);
}