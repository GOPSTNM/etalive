const api_base = "https://data.etabus.gov.hk/v1/transport/kmb";
const name_word_replacements_en = {
    "BBI": "BBI",
    "Ground Transportation Centre": "GTC",
    "GTC": "GTC",
    "II": "II",
    "HKCECE": "Exhibition Centre",
    "HK": "HK",
    "H.K.": "HK",
    "O'Brien": "O'Brien",
    "EKCC": "EKCC",
    "HACTL": "HACTL",
    "JPC": "JPC",
}
const name_escaped_keys_en = Object.keys(name_word_replacements_en).map(key => key.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
const name_replacements_regex_en = new RegExp(`(?<=^|\\s|\\(|-)${name_escaped_keys_en.join("|")}(?=\\s|\\)|-|$)`, "gi");
const name_word_replacements_tc = {
    "II": "II"
}
const name_escaped_keys_tc = Object.keys(name_word_replacements_tc).map(key => key.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
const name_replacements_regex_tc = new RegExp(`(?<=^|\\s|\\(|-)${name_escaped_keys_tc.join("|")}(?=\\s|\\)|-|$)`, "gi");
const name_pole_id_regex = /\s\(([A-Z]{2}\d{3}[A-Z]?)\)$/i;
const name_title_case_regex = /(?<=^|[\s\-()\/])[a-z]/g;
let route_data = {};
let eta_data = {};
let route_terminus_index = {};
setup();
async function setup() {
    route_data = await local_storage_item("kmb_rte_data", `${api_base}/route/`, 7);
    const url_params = new URLSearchParams(window.location.search);
    if (url_params.has("r")) {
        document.getElementById("rte_input").value = url_params.get("r");
    }
    rte_input_change();
    if (url_params.has("d")) {
        document.getElementById("rte_options_select").value = url_params.get("d");
        update();
    }
}
function proper_stop_name_id(name) {
    const pole_id = name.match(name_pole_id_regex);
    return pole_id ? pole_id[1] : "";
}
function proper_stop_name_en(name) {
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
function proper_stop_name_tc(name) {
    const stop_name = name.replace(name_pole_id_regex, "").trim().replace(/,(?!\s)/g, ", ");
    let proper_stop_name = stop_name.toLowerCase().replace(name_title_case_regex, (txt) => {
        return txt.toUpperCase();
    });
    return proper_stop_name.replace(name_replacements_regex_en, (matched) => {
        const name_replace_key = Object.keys(name_word_replacements_tc).find(
            key => key.toLowerCase() === matched.toLowerCase()
        );
        return name_word_replacements_tc[name_replace_key] || matched;
    });
}
function rte_input_change() {
    const rte_input = document.getElementById("rte_input").value;
    const rte_options_select = document.getElementById("rte_options_select");
    document.getElementById("rte_input").value = rte_input.toUpperCase();
    rte_options_select.innerHTML = "<option value='' selected disabled>Select Direction</option>";
    let rte_first = true;
    for (const rte_data of route_data["data"]) {
        if (rte_data["route"] == rte_input.toUpperCase()) {
            let rte_str = `${proper_stop_name(rte_data["orig_en"])[0]} to ${proper_stop_name(rte_data["dest_en"])[0]}`
            if (rte_data["service_type"] != 1) {
                rte_str += ` [Spec Dep ${rte_data["service_type"]}]`
            }
            rte_options_select.append(new Option(rte_str, `${rte_data["bound"]}${rte_data["service_type"]}`, false, rte_first));
            rte_first = false;
        }
    }
}
async function get_stop_name(stop_id) {
    const label = `kmb_stop_name/${stop_id}`;
    let data_dictionary = {};
    let return_data;
    if (localStorage.getItem("kmb_data_dictionary")) {
        data_dictionary = JSON.parse(localStorage.getItem("kmb_data_dictionary"));
    }
    if (data_dictionary[label] && localStorage.getItem(label) && (Date.now() - data_dictionary[label]) < (7 * 86400000)) {
        return_data = JSON.parse(localStorage.getItem(label));
    } else {
        stop_fetch = await (await fetch(`${api_base}/stop/${stop_id}`)).json();
        stop_fetch_data = stop_fetch["data"];
        return_data = [proper_stop_name_en(stop_fetch_data["name_en"]), proper_stop_name_tc(stop_fetch_data["name_tc"]), proper_stop_name_id(stop_fetch_data["name_en"]), stop_fetch_data["lat"], stop_fetch_data["long"]];
        localStorage.setItem(label, JSON.stringify(return_data));
        data_dictionary[label] = Date.now();
        localStorage.setItem("kmb_data_dictionary", JSON.stringify(data_dictionary))
    }
    return return_data;
}
async function update() {
    if (!document.getElementById("rte_options_select").value) {
        document.getElementById("message_area").innerHTML = "Invalid route or direction, please input again.";
        return;
    }
    document.getElementById("message_area").innerHTML = "Please wait";
    try {
        const rte_options_select = document.getElementById("rte_options_select");
        const bound = rte_options_select.value[0];
        const service_type = rte_options_select.value[1];
        const route = document.getElementById("rte_input").value.toUpperCase();
        const eta_data = await (await fetch(`${api_base}/route-eta/${route}/${service_type}`)).json();
        const stop_data_url = `${api_base}/route-stop/${route}/${bound == "I" ? "inbound" : "outbound"}/${service_type}`;
        const stop_data = await local_storage_item(`kmb_rte_stop_list/${route}/${bound}/${service_type}`, stop_data_url, 7);
        let stop_names = [];
        const stop_promises = stop_data["data"].map(async (i) => {
            const stop_name_data = await get_stop_name(i["stop"]);
            return {
                seq: Number(i["seq"]) - 1,
                data: [i["stop"], stop_name_data]
            };
        });
        const results = await Promise.all(stop_promises);
        results.forEach(res => {
            stop_names[res.seq] = res.data;
        });
        let eta_list = {};
        for (const i of eta_data["data"]) {
            if (i["dir"] == bound && i["eta"]) {
                if (!eta_list[Number(i["seq"])-1]) {
                    eta_list[Number(i["seq"])-1] = [];
                }
                eta_list[Number(i["seq"])-1].push([i["eta"], i["rmk_en"]]);
            }
        }
        to_display(eta_list, stop_data, bound, stop_names);
    } catch (error) {
        console.log(error);
        document.getElementById("message_area").innerHTML = "An error occurred, please try again.";
        localStorage.removeItem("kmb_data_dictionary");
        setup();
    }
}
async function to_display(eta_list, stop_data, bound, stop_names) {
    document.getElementById("message_area").innerHTML = "";
    eta_data = eta_list;
    let results = "";
    for (let i = 0; i < stop_names.length; i++) {
        results += `<div id="stop_disp_${i}" class="stop_disp">`;
        let circ_colour = "y";
        if (!eta_list[i]) {
            circ_colour = "g";
        }
        results += `<div class='circle_${circ_colour}' onclick='stop_eta_update("${stop_names[i][0]}");'></div>`;
        results += `<div onclick='stop_click(${i});'>`;
        results += `<p class='stop_disp_name'><span class='text_bold'>${i}</span> ${stop_names[i][1][0]} <span class='text_desc'>${stop_names[i][1][2]}</span></p>`;
        results += "</div>";
        results += "</div>";
    }
    document.getElementById("results").innerHTML = results;
}
async function stop_eta_update(stop_id) {
    let dialog_results = "";
    const stop_name_data = await get_stop_name(stop_id);
    const stop_name = [stop_id, stop_name_data];
    dialog_results += `<span class='title_inline_block'>${stop_name[1][0]}</span> `;
    dialog_results += `<span class='title_inline_block'>${stop_name[1][1]}</span> `;
    dialog_results += `<span class='title_inline_block text_desc'>${stop_name[1][2]}</span>`;
    document.getElementById("stop_eta_disp_title").innerHTML = dialog_results;
    document.getElementById("stop_eta_disp_eta").replaceChildren();
    document.getElementById("stop_eta_disp_eta").innerHTML = "<p class='text_bold'>Please wait</p>";
    show_stop_dialog(true);
    stop_eta_display(stop_id, await stop_eta_fetch(stop_id));
}
async function find_terminus_index(route, bound, service_type) {
    const object_key = `${route}/${bound}/${service_type}`;
    if (route_terminus_index[object_key]) {
        return route_terminus_index[object_key];
    } else {
        const stop_data_url = `${api_base}/route-stop/${route}/${bound == "I" ? "inbound" : "outbound"}/${service_type}`;
        const stop_data = await local_storage_item(`kmb_rte_stop_list/${route}/${bound}/${service_type}`, stop_data_url, 7);
        const seq_values = stop_data["data"].map(item => item["seq"]);
        const terminus_index = Math.max(...seq_values);
        route_terminus_index[object_key] = terminus_index;
        return terminus_index;
    }
}




async function stop_eta_fetch(stop_id) {
    const eta_data = await (await fetch(`${api_base}/stop-eta/${stop_id}`)).json();
    let eta_presort = {};
    let eta_rd = {};
    for (const i of eta_data["data"]) {
        const rd_string = `${i["route"]}/${i["dir"]}`;
        const sub_data_id = `${i["route"]}/${i["dir"]}/${i["seq"]}`;
        const dest_string = proper_stop_name(i["dest_en"])[0];
        if (!eta_rd[rd_string]) {
            eta_rd[rd_string] = {st: i["service_type"], dest: [dest_string]};
        }
        if (eta_rd[rd_string]["st"] === i["service_type"]) {
            // consider add eta data
            const eta_list = [i["eta"], i["rmk_en"], i["rmk_tc"]];
            let display_type = 0;
            if (!i["eta"]) {
                if (i["rmk_en"]) {
                    display_type = 2;
                } else {
                    display_type = 3;
                }
            } else {
                try {
                    const terminus_index = await find_terminus_index(i["route"], i["dir"], i["service_type"]);
                    if (terminus_index === i["seq"]) {
                        display_type = 1;
                    }
                } catch (e) {
                    console.log(e);
                }
            }
            if (!eta_presort[sub_data_id]) {
                const seq = i["seq"];
                eta_presort[sub_data_id] = [display_type, [eta_list]];
            } else {
                eta_presort[sub_data_id][1].push(eta_list);
            }
        } else {
            // add dest if not repeat
            if (!eta_rd[rd_string]["dest"].includes(dest_string)) {
                eta_rd[rd_string]["dest"].push(dest_string);
            }
        }
    }
    const eta_sorted = Object.entries(eta_presort).sort((a, b) => {
        return a[1][0] - b[1][0];
    });
    return [eta_sorted, eta_rd];
}
function stop_eta_display(stop_id, [eta_sorted, eta_rd]) {
    console.log(eta_sorted);
    console.log(eta_rd);
    let results = "<table class='eta_data'>";
    for (const i of eta_sorted) {
        const sub_data = i[0].split("/");
        const dest_string = eta_rd[`${sub_data[0]}/${sub_data[1]}`]["dest"].join("/ ");
        let rte_dest_table = `${sub_data[0]} <span class="text_medium title_inline_block">${dest_string}</span>`
        const display_type = i[1][0];
        if (display_type === 0 || display_type === 1) {
            if (display_type === 1) {
                rte_dest_table = `${sub_data[0]} <span class="text_medium title_inline_block">Terminates Here</span>`;
            }
            let eta_disp_content = "";
            for (const k of i[1][1]) {
                const eta_time = k[0];
                const eta_time_mins = time_difference_format(eta_time);
                const time_data = `<span class="text_bold">${eta_time_mins}</span> <span class="text_small">min</span>`;
                eta_disp_content += `<td width="100px">${time_data}</td>`;
            }
            results += `<tr><td width="100px">${rte_dest_table}</td>${eta_disp_content}</tr>`;
        } else if (display_type === 2) {
            results += `<tr><td>${rte_dest_table}</td><td colspan="3">${i[1][1][0][1]}</td></tr>`;
        } else {
            results += `<tr><td>${rte_dest_table}</td><td colspan="3">No Service</td></tr>`;
        }
    }
    results += "</table>";
    const parser = new DOMParser();
    const doc = parser.parseFromString(results, "text/html");
    document.getElementById("stop_eta_disp_eta").replaceChildren(doc.body.firstChild);
}
function window_disp_click(e) {
    const wrapper = document.querySelector(".window_disp_elem");
    if (!wrapper.contains(e.target)) {
        show_stop_dialog(false);
    }
}
function show_stop_dialog(show) {
    const stop_dialog = document.getElementById("stop_eta_disp");
    if (show) {
        stop_dialog.showModal();
    } else {
        stop_dialog.close();
    }
}
function time_show_format(t) {
    return new Date(t).toTimeString().slice(0, 8);
}
function time_difference_format(t) {
    return Math.round((new Date(t) - new Date())/6000)/10;
}
function stop_click(i) {
    if (document.getElementById(`stop_table_${i}`)) {
        document.getElementById(`stop_table_${i}`).remove();
        return;
    }
    let results = "";
    if (eta_data[i]) {
        results += `<div class="margin_bottom" id="stop_table_${i}">`;
        results += "<table class='eta_data'>";
        stop_eta_data = eta_data[i];
        for (let k = 0; k < stop_eta_data.length; k++) {
            const eta_time = stop_eta_data[k][0];
            const eta_time_mins = time_difference_format(eta_time);
            let time_data = "";
            if (i == 0 || i == eta_data.length - 1) {
            time_data = `<span class="text_bold">${eta_time_mins}</span> <span class="text_small">min</span>`;
            } else if (eta_time_mins < -0.5) {
            time_data = "<span class='text_bold'>Departed</span>";
            } else if (eta_time_mins < 0) {
            time_data = "<span class='text_bold'>Departing</span>";
            } else if (eta_time_mins < 0.5) {
            time_data = "<span class='text_bold'>Arriving</span>";
            } else {
            time_data = `<span class="text_bold">${eta_time_mins}</span> <span class="text_small">min</span>`;
            }
            results += "<tr>";
            results += `<td style="width: 130px">${time_show_format(eta_time)}</td>`;
            results += `<td style="width: 100px">${time_data}</td>`;
            if (stop_eta_data[k][1]) {
                results += `<td style="width: calc(100% - 230px)"><span class='text_medium'>${stop_eta_data[k][1]}</span></td>`;
            } else {
                results += "<td style='width: calc(100% - 230px)'></td>";
            }
            results += "</tr>";
        }
        results += "</table>";
        results += "</div>";
        }
    const parser = new DOMParser();
    const doc = parser.parseFromString(results, "text/html");
    document.getElementById("stop_disp_" + i).after(...doc.body.children);
}
async function local_storage_item(label, url, validity_period) {
    let data_dictionary = {};
    let return_data;
    if (localStorage.getItem("kmb_data_dictionary")) {
        data_dictionary = JSON.parse(localStorage.getItem("kmb_data_dictionary"));
    }
    if (data_dictionary[label] && localStorage.getItem(label) && (Date.now() - data_dictionary[label]) < (validity_period * 86400000)) {
        return_data = JSON.parse(localStorage.getItem(label));
    } else {
        return_data = await (await fetch(url)).json();
        localStorage.setItem(label, JSON.stringify(return_data));
        data_dictionary[label] = Date.now();
        localStorage.setItem("kmb_data_dictionary", JSON.stringify(data_dictionary))
    }
    return return_data;
}
function proper_stop_name(name) {
    return [proper_stop_name_en(name),  proper_stop_name_id(name)];
}