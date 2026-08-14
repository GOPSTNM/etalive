let ctb_route_data;
let ctb_route_eta;
let ctb_stop_eta;
async function ctb_setup_eta_page() {
    await ctb_setup();
    const url_params = new URLSearchParams(window.location.search);
    if (url_params.has("r")) {
        document.getElementById("rte_input").value = url_params.get("r");
    }
    await ctb_rte_input_change();
    if (url_params.has("d")) {
        document.getElementById("rte_options_select").value = url_params.get("d");
        ctb_update();
    }
}
async function ctb_setup() {
    ctb_route_data = await ctb_local_storage_item("ctb_route_data", "https://rt.data.gov.hk/v2/transport/citybus/route/ctb", 7);
}
async function ctb_local_storage_item(label, url, validity_period) {
    const max_fetch_attempt = 10;
    let data_dictionary = {};
    let return_data;
    if (localStorage.getItem("ctb_data_dictionary")) {
        data_dictionary = JSON.parse(localStorage.getItem("ctb_data_dictionary"));
    }
    if (data_dictionary[label] && localStorage.getItem(label) && (Date.now() - data_dictionary[label]) < (validity_period * 86400000)) {
        return_data = JSON.parse(localStorage.getItem(label));
    } else {
        let error;
        for (let i = 0; i < max_fetch_attempt; i++) {
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
        localStorage.setItem("ctb_data_dictionary", JSON.stringify(data_dictionary))
    }
    return return_data;
}
async function ctb_get_route_stop(rte, dir) {
    return await (await fetch(`https://rt.data.gov.hk/v2/transport/citybus/route-stop/ctb/${rte}/${dir == "I" ? "inbound" : "outbound"}`)).json();
}
async function ctb_get_stop_data(stop_id) {
    const stop_data = (await (await fetch(`https://rt.data.gov.hk/v2/transport/citybus/stop/${stop_id}`)).json())["data"];
    return [stop_data["name_en"].split(", ")[0], stop_data["name_tc"].split(", ")[0],
    stop_data["name_en"].split(", ")[1] ? stop_data["name_en"].split(", ")[1] : "",
    stop_data["name_tc"].split(", ")[1] ? stop_data["name_tc"].split(", ")[1] : "",
    stop_data["lat"], stop_data["long"]];
}
async function ctb_rte_input_change() {
    const rte_input = document.getElementById("rte_input").value;
    const rte_options_select = document.getElementById("rte_options_select");
    document.getElementById("rte_input").value = rte_input.toUpperCase();
    if (!ctb_route_data) {
        return;
    }
    rte_options_select.innerHTML = "<option value='' selected disabled>Select Direction</option>";
    for (const rte_data of ctb_route_data["data"]) {
        if (rte_data["route"] == rte_input.toUpperCase()) {
            rte_options_select.innerHTML = "<option value='' selected disabled>Please wait</option>";
            const inbound_data = await ctb_get_route_stop(rte_input, "I");
            rte_options_select.innerHTML = "<option value='' selected disabled>Select Direction</option>";
            let rte_str = `${rte_data["orig_en"]} to ${rte_data["dest_en"]}`
            rte_options_select.append(new Option(rte_str, "O", false, true));
            if (inbound_data["data"].length != 0) {
                rte_str = `${rte_data["dest_en"]} to ${rte_data["orig_en"]}`
                rte_options_select.append(new Option(rte_str, "I", false, false));
            }
        }
    }
}
async function ctb_update() {
    if (!document.getElementById("rte_options_select").value) {
        document.getElementById("message_text_area").innerHTML = "Invalid route or direction, please input again.";
        return;
    }
    document.getElementById("message_text_area").innerHTML = "Please wait";
    try {
        const bound = document.getElementById("rte_options_select").value;
        const route = document.getElementById("rte_input").value.toUpperCase();
        const route_stop_data = await ctb_get_route_stop(route, bound);
        ctb_route_eta = await Promise.all(
            route_stop_data["data"].map(async (i) => {
                const eta_data = (await (await fetch(`https://rt.data.gov.hk/v2/transport/citybus/eta/ctb/${i["stop"]}/${route}`)).json())["data"].filter(k => {
                    return k["dir"] == bound;
                });
                const eta_list = eta_data.sort((a, b) => a["eta_seq"] - b["eta_seq"]).map(k => {
                    return [k["eta"], k["dest_en"], k["dest_tc"], k["rmk_en"], k["rmk_tc"], k["eta_seq"]];
                })
                const stop_data = await ctb_get_stop_data(i["stop"]);
                return [i["seq"], i["stop"], stop_data, eta_list];
            })
        );
        ctb_to_display();
    } catch (error) {
        console.log(error);
        document.getElementById("message_text_area").innerHTML = "An error occurred, please reload and try again.";
        localStorage.removeItem("ctb_data_dictionary");
    }
}
async function ctb_to_display() {
    let results = "";
    for (const [seq, data] of Object.entries(ctb_route_eta)) {
        results += `<div id="stop_disp_${seq}" class="list_display_stop">`;
        let circ_colour = "y";
        if (data[3].length == 0) {
            circ_colour = "g";
        }
        results += `<div class='circle_${circ_colour}' onclick='ctb_stop_update(["${data[1]}"]);'></div>`;
        results += `<div onclick='ctb_stop_click("${seq}");'>`;
        results += `<p class='list_display_stop_name'><span class='text_bold'>${seq}</span> ${data[2][0]} <span class='text_name_details'>${data[2][2]}</span></p>`;
        results += "</div>";
        results += "</div>";
        results += "</div>";
    }
    document.getElementById("message_text_area").innerHTML = "";
    document.getElementById("results").innerHTML = results;
}
function ctb_stop_click(i) {
    if (document.getElementById(`stop_table_${i}`)) {
        document.getElementById(`stop_table_${i}`).remove();
        return;
    }
    let results = "";
    if (ctb_route_eta[i][3].length != 0) {
        results += `<table class='eta_table' id='stop_table_${i}'>`;
        for (const k of ctb_route_eta[i][3]) {
            const eta_time = k[0];
            let time_str = "";
            let mins_str = "";
            let rmk_str = "";
            if (eta_time) {
                time_str = time_show_format(eta_time);
                const eta_time_mins = time_difference_format(eta_time);
                const dest = k[1];
                if (i == 0 || i == ctb_route_eta.length - 1) {
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
                rmk_str = `<span class='text_fit_destin' style='--chars: ${k[1].length}'>${k[1]}</span>`;
                if (k[3]) {
                    rmk_str += `<span class='text_medium'>${k[3]}</span>`;
                }
            } else if (k[3] == "KMB Cycle") {
                time_str = "KMB";
                mins_str = "-"
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
async function ctb_stop_update(stop_id) {
    let dialog_results = "";
    for (const i of stop_id) {
        const stop_name_data = await ctb_get_stop_data(i);
        dialog_results += "<p class='text_dialog_title' id='stop_eta_disp_title'>";
        dialog_results += `<span>${stop_name_data[0]}</span> `;
        dialog_results += `<span>${stop_name_data[1]}</span> `;
        dialog_results += `<span class='text_name_details'>${stop_name_data[2]}</span> `;
        dialog_results += `<span class='text_name_details'>${stop_name_data[3]}</span>`;
        dialog_results += "</p>";
        dialog_results += `<div id='stop_eta_${i}'><p class='message_text_area'>Please wait</p></div>`;
    }
    document.getElementById("stop_eta_disp_elem").innerHTML = dialog_results;
    ctb_show_stop_dialog(true);
    ctb_stop_eta = {};
    for (const i of stop_id) {
        const eta_data = (await (await fetch(`https://rt.data.gov.hk/v1/transport/batch/stop-eta/ctb/${i}`)).json())["data"];
        let eta_list = {};
        eta_data.forEach(i => {
            const eta = i["eta"];
            const dest = i["dest"];
            const dir = i["dir"];
            const eta_seq = i["eta_seq"];
            const rmk = i["rmk"];
            const route = i["route"];
            const key = `${route}/${dir}/${dest}`;
            if (!eta_list[key]) {
                eta_list[key] = {
                    route: route,
                    dir: dir,
                    dest: dest,
                    data: []
                };
            }
            eta_list[key]["data"].push([eta, rmk, eta_seq]);
        });
        let eta_list_sorted = Object.values(eta_list).map(i => {
            i["data"].sort((a, b) => a["eta_seq"] - b["eta_seq"]);
            return [i["route"], i["dir"], i["dest"], i["data"]];
        });
        ctb_stop_eta[i] = eta_list_sorted;
    }
    ctb_stop_to_display();
    return;
}
function ctb_stop_to_display() {
    for (const [key, data] of Object.entries(ctb_stop_eta)) {
        let results = "<div class='stop_eta_table'>";
        for (const i of data) {
            results += `<div><div>${i[0]} <span class='text_medium'>${i[2]}</span></div>`;
            for (const k of i[3]) {
                if (k[0]) {
                    results += `<div><span class="text_bold">${time_difference_format(k[0])}</span> <span class="text_small">min</span></div>`;
                } else if (k[1] == "KMB Cycle") {
                    results += "<div class='text_medium'>KMB</div>";
                }
            }
            results += "</div>";
        }
        results += "</div>";
        document.getElementById(`stop_eta_${key}`).innerHTML = results;
    }
    function time_difference_format(t) {
        return Math.round((new Date(t) - new Date()) / 60000);
    }
}
function ctb_window_disp_click(e) {
    const wrapper = document.querySelector(".window_disp_elem");
    if (!wrapper.contains(e.target)) {
        ctb_show_stop_dialog(false);
    }
}
function ctb_show_stop_dialog(show) {
    const stop_dialog = document.getElementById("stop_eta_disp");
    if (show) {
        stop_dialog.showModal();
    } else {
        stop_dialog.close();
    }
}