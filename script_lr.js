let lr_stop_data;
let lr_stop_eta;
let lr_stop_eta_refresh;
async function lr_setup() {
    await fetch("https://gopstnm.github.io/etalive/data/lr_stop_data.json")
        .then(response => {
            return response.json();
        })
        .then(data => {
            lr_stop_data = data;
        });
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
                results += `<tr><td colspan='4' class='text_fit_destin'>${k["route_no"]} ${k["routeRemarkEng2"]}</td></tr>`;
            }
        }
    }
    results += "</table>";
    document.getElementById("results").innerHTML = results;
    return;
}