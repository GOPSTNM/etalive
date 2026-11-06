let lr_stop_data;
let lr_stop_eta;
async function lr_setup() {
    try {
        lr_stop_data = await lr_local_storage_item("lr_stop_data", "https://gopstnm.github.io/etalive/data/lr_stop_data.json", 30);
        console.log("Setup data completed.");
    } catch (error) {
        console.log("Setup data failed.");
        document.getElementById("message_text_area").innerHTML = "An error occured. Please reload the page.";
        alert("An error occured. Please reload the page.");
    }
}
async function lr_setup_eta_page() {
    await lr_setup();
    lr_zone_change();
    const url_params = new URLSearchParams(window.location.search);
    if (url_params.has("s")) {
        document.getElementById("lr_stop").value = url_params.get("s");
        lr_update();
    }
}
async function lr_local_storage_item(label, url, validity_period) {
    const max_fetch_attempt = 10;
    let data_dictionary = {};
    let return_data;
    if (localStorage.getItem("lr_data_dictionary")) {
        data_dictionary = JSON.parse(localStorage.getItem("lr_data_dictionary"));
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
        localStorage.setItem("lr_data_dictionary", JSON.stringify(data_dictionary))
    }
    return return_data;
}
function lr_zone_change() {
    if (document.getElementById("lr_zone").value == 7) {
        let optionlist = "";
        for (let i = 0; i < 7; i++) {
            optionlist += `<optgroup label="${Object.keys(lr_stop_data)[i]}">${optionreturn(i)}</optgroup>`;
        }
        document.getElementById("lr_stop").innerHTML = optionlist;
    } else {
        document.getElementById("lr_stop").innerHTML = optionreturn(document.getElementById("lr_zone").value);
    }
    function optionreturn(zone) {
        let return_string = "";
        for (const [key, value] of Object.entries(lr_stop_data[Object.keys(lr_stop_data)[zone]])) {
            return_string += `<option value="${key}">${value[0]} ${value[1]}</option>`;
        }
        return return_string;
    }
}
async function lr_update() {
    if (!document.getElementById("lr_stop").value) {
        document.getElementById("message_text_area").innerHTML = "Invalid stop, please wait and input again.";
        return;
    }
    document.getElementById("message_text_area").innerHTML = "Please wait";
    try {
        const stop_id = document.getElementById("lr_stop").value;
        lr_stop_eta = await (await fetch(`https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule?station_id=${stop_id}&with_special=1`)).json();
        lr_to_display();
    } catch (error) {
        console.log(error);
        document.getElementById("message_text_area").innerHTML = "An error occurred, please reload and try again.";
        localStorage.removeItem("lr_data_dictionary");
    }
}
function lr_to_display() {
    console.log(lr_stop_eta);
    let results = "";
    document.getElementById("message_text_area").innerHTML = "";
    results += `<table class='eta_table'>`;
    for (const i of lr_stop_eta["platform_list"]) {
        results += `<tr><td colspan='4' class='text_page_inst'>Platform ${i["platform_id"]}</td></tr>`;
        if (!i["route_list"]) {
            continue;
        }
        for (const k of i["route_list"]) {
            if (k["route_no"] && k["dest_en"] && k["time_en"] && k["special"] === 0) {
                let time_str = k["time_en"].replace(" mins", " <span class='text_small'>min</span>");
                let route_str = k["route_no"];
                let dest_str = k["dest_en"].replace("Tuen Mun ", "");
                let car_str = "<img alt='1 Car' height='20' src='https://gopstnm.github.io/etalive/logo/lr_car_logo.svg'>";
                if (k["train_length"] === 2) {
                    car_str = "<img alt='2 Car' height='20' src='https://gopstnm.github.io/etalive/logo/lr_car_logo.svg'> <img alt='' height='20' src='https://gopstnm.github.io/etalive/logo/lr_car_logo.svg'>";
                }
                results += "<tr>";
                results += `<td style="width: 55px;">${route_str}</td>`;
                results += `<td style="width: 135px;">${dest_str}</td>`;
                results += `<td style="width: 75px;">${car_str}</td>`;
                results += `<td style="width: 80px;">${time_str}</td>`;
                results += "</tr>";
            } else if (k["route_no"] && k["dest_en"] && k["time_en"] && k["special"] === 1) {
                let time_str = k["time_en"].replace(" mins", " <span class='text_small'>min</span>");
                let route_str = k["additionalInfo1"];
                let dest_str = k["dest_en"].replace("Tuen Mun ", "");
                let car_str = "<img alt='1 Car' height='20' src='https://gopstnm.github.io/etalive/logo/lr_car_logo.svg'>";
                if (k["train_length"] === 2) {
                    car_str = "<img alt='2 Car' height='20' src='https://gopstnm.github.io/etalive/logo/lr_car_logo.svg'> <img alt='' height='20' src='https://gopstnm.github.io/etalive/logo/lr_car_logo.svg'>";
                }
                results += "<tr>";
                results += `<td style="width: 55px;">${route_str}</td>`;
                results += `<td style="width: 135px;">${dest_str}</td>`;
                results += `<td style="width: 75px;">${car_str}</td>`;
                results += `<td style="width: 80px;">${time_str}</td>`;
                results += "</tr>";
                results += `<tr><td colspan='4' class='text_page_desc'>${k["route_no"]} ${k["routeRemarkEng2"]}</td></tr>`;
            }
        }
    }
    results += "</table>";
    document.getElementById("results").innerHTML = results;
    return;
}