function stop_name_update() {
    document.getElementById("message_text_area").innerHTML = "Please wait";
    let results = "";
    for (const i of kmb_stop_data["data"]) {
        if (i["name_en"].toUpperCase().includes(document.getElementById("name_input").value.toUpperCase())) {
            results += `<div id="stop_disp_" class="list_display_stop">`;
            let circ_colour = "y";
            results += `<div class='circle_${circ_colour}' onclick='kmb_stop_update(["${i["stop"]}"]);'></div>`;
            results += `<div onclick='kmb_stop_click();'>`;
            results += `<p class='list_display_stop_name'>${kmb_proper_stop_name_en(i["name_en"])} <span class='text_name_details'>${kmb_proper_stop_name_id(i["name_en"])}</span></p>`;
            results += "</div>";
            results += "</div>";
        }
    }
    document.getElementById("message_text_area").innerHTML = "";
    document.getElementById("results").innerHTML = results;
}