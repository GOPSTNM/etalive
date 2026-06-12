let all_stop_data;
setup_stop_data();
function setup_stop_data() {
  fetch("bus_data/bus_interchange.json")
  .then(response => {
    return response.json();
  })
  .then(data => {
    all_stop_data = data;
  });
}
async function update() {
  const stop_data = all_stop_data[Object.keys(all_stop_data)[document.getElementById("bus_stop").value]];
  const plat_data = stop_data[Object.keys(stop_data)[document.getElementById("stop_dir").value]];
  try {
    const responses = await Promise.all(plat_data.map(pd => fetch(`https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${pd[1]}`)));
    const received_data = await Promise.all(responses.map(response => response.json()));
    to_display(received_data);
  } catch (error) {
    console.log(error);
  }
}
function to_display(received_data) {
  let results = "";
  for (let i = 0; i < received_data.length; i++) {
    const stop_data = all_stop_data[Object.keys(all_stop_data)[document.getElementById("bus_stop").value]];
    const plat_data = stop_data[Object.keys(stop_data)[document.getElementById("stop_dir").value]];
    results += `<p>${plat_data[i][0]}</p>`;
    let processed_data = {};
    for (const k of received_data[i]["data"]) {
      if (k["eta"]) {
        if (processed_data[k["route"]] && !processed_data[k["route"]].includes(new Date(k["eta"]))) {
          processed_data[k["route"]].push([k["seq"], new Date(k["eta"])]);
        } else {
          processed_data[k["route"]] = [k["dest_en"], [k["seq"], new Date(k["eta"])]];
        }
      }
    }
    console.log(processed_data);
    Object.entries(processed_data).forEach(([key, value]) => {
      results += `<br>${key} ${value[0]}`;
      for (let i = 1; i < value.length; i++) {
        if ((new Date(value[i][1]) - new Date())/60000 < -2) {
          return;
        }
        results += ` ${Math.round((new Date(value[i][1]) - new Date())/6000)/10}`;
      }
    });
  }
  document.getElementById("results").innerHTML = results;
}