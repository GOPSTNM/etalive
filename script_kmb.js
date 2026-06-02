const api_base = "https://data.etabus.gov.hk/v1/transport/kmb";
let route_data = {};
let eta_data = {};
setup();
async function setup() {
    route_data = await local_storage_item("kmb_rte_data", api_base + "/route/", 7);
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
function proper_stop_name(name) {
    const regex = /\s\(([A-Z]{2}\d{3}[A-Z]?)\)$/i;
    const match = name.match(regex);
    let cleanName = name.replace(regex, "").trim();
    let titleCase = cleanName.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
    return [titleCase, match ? match[1] : ""];
}
async function update() {
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
            let i_stop_data = await local_storage_item(`kmb_stop/${i["stop"]}`, `${api_base}/stop/${i["stop"]}`, 7);
            return {
                seq: Number(i["seq"]) - 1,
                data: [i["stop"], proper_stop_name(i_stop_data["data"]["name_en"]), proper_stop_name(i_stop_data["data"]["name_tc"]), i_stop_data["data"]["lat"], i_stop_data["data"]["long"]]
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
                eta_list[Number(i["seq"])-1].push([i["eta"], i["rmk_en"], i["rmk_tc"]]);
            }
        }
        to_display(eta_list, stop_data, bound, stop_names);
    } catch (error) {
        console.log(error);
        localStorage.removeItem("kmb_data_dictionary");
        location.reload();
    }
}
async function to_display(eta_list, stop_data, bound, stop_names) {
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
        results += `<p class='stop_disp_name'><span class='text_bold'>${i}</span> ${stop_names[i][1][0]} <span class='text_desc'>${stop_names[i][1][1]}</span></p>`;
        results += "</div>";
        results += "</div>";
    }
    document.getElementById("results").innerHTML = results;
}
async function stop_eta_update(stop_id) {
    let dialog_results = "";
    const stop_name_data = await local_storage_item(`kmb_stop/${stop_id}`, `${api_base}/stop/${stop_id}`, 7);
    const stop_name = [stop_id, proper_stop_name(stop_name_data["data"]["name_en"]), proper_stop_name(stop_name_data["data"]["name_tc"]), stop_name_data["data"]["lat"], stop_name_data["data"]["long"]];
    dialog_results += "<p class='window_disp_title'>";
    dialog_results += `<span class='window_disp_title_text'>${stop_name[1][0]}</span> `;
    dialog_results += `<span class='window_disp_title_text'>${stop_name[2][0]}</span> `;
    dialog_results += `<span class='window_disp_title_text text_desc'>${stop_name[1][1]}</span>`;
    dialog_results += "</p>";
    const eta_data = await (await fetch(`${api_base}/stop-eta/${stop_id}`)).json();
    let eta_sorted = {};
    let inactive_sorted = {};
    console.log(eta_data);
    eta_data["data"].forEach((i) => {
        if (i["eta"]) {
            if (!eta_sorted[`${i["route"]}${i["dir"]}`]){
                eta_sorted[`${i["route"]}${i["dir"]}`] = [[i["service_type"], i["dest_en"]], {}];
            }
            if (!eta_sorted[`${i["route"]}${i["dir"]}`][0].includes(i["dest_en"])) {
                eta_sorted[`${i["route"]}${i["dir"]}`][0].push(i["dest_en"]);
            }
            if (eta_sorted[`${i["route"]}${i["dir"]}`][0][0] === i["service_type"]) {
                // Consider ETA
                eta_sorted[`${i["route"]}${i["dir"]}`][1][i["seq"]] = [i["eta"], i["rmk_en"], i["rmk_tc"]];
            }
        } else {
        }
    }); 
    console.log(eta_sorted);
    document.getElementById("stop_eta_disp_elem").innerHTML = dialog_results;
    show_stop_dialog(true);
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
    if (document.getElementById(`${i}_table`)) {
        document.getElementById(`${i}_table`).remove();
        return;
    }
    let results = "";
    if (eta_data[i]) {
        results += `<div id='${i}_table'>`;
        results += "<table class='eta_data'>";
        stop_eta_data = eta_data[i];
        for (let k = 0; k < stop_eta_data.length; k++) {
            let eta_time = stop_eta_data[k][0];
            let eta_time_mins = time_difference_format(eta_time);
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
                results += `<td style="width: calc(100vw - 230px)"><span class='text_medium'>${stop_eta_data[k][1]}</span></td>`;
            } else {
                results += "<td style='width: calc(100vw - 230px)'></td>";
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
