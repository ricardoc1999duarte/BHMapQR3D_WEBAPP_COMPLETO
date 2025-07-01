
const input = document.getElementById("numeroPo");
const btnBuscar = document.getElementById("btnBuscar");
const btnExportarHTML = document.getElementById("btnExportarHTML");
const btnExportarExcel = document.getElementById("btnExportarExcel");
const btnExportarPDF = document.getElementById("btnExportarPDF");
const btnCompartilharZap = document.getElementById("btnCompartilharZap");
const resultado = document.getElementById("resultado");
const dadosObraDiv = document.getElementById("dadosObra");
const mapa2dDiv = document.getElementById("mapa2d");
const cesiumDiv = document.getElementById("cesiumContainer");
const erroDiv = document.getElementById("erro");
const qrcodeDiv = document.getElementById("qrcode");
const historicoUl = document.getElementById("historico");

let dadosObra = null;
let lastCoords = null;
let historico = JSON.parse(localStorage.getItem("bhmap_historico") || "[]");

function atualizarHistorico(po) {
  if (!po) return;
  historico = historico.filter(item => item !== po);
  historico.unshift(po);
  if (historico.length > 10) historico.pop();
  localStorage.setItem("bhmap_historico", JSON.stringify(historico));
  renderHistorico();
}
function renderHistorico() {
  historicoUl.innerHTML = "";
  if (!historico.length) historicoUl.innerHTML = "<li>Nenhuma busca recente</li>";
  historico.forEach(po => {
    const li = document.createElement("li");
    li.textContent = po;
    li.style.cursor = "pointer";
    li.onclick = () => { input.value = po; btnBuscar.click(); };
    historicoUl.appendChild(li);
  });
}
renderHistorico();

btnBuscar.onclick = async () => {
  erroDiv.style.display = "none";
  resultado.style.display = "none";
  mapa2dDiv.innerHTML = "";
  cesiumDiv.innerHTML = "";
  dadosObraDiv.innerHTML = "";
  qrcodeDiv.innerHTML = "";
  [btnExportarHTML,btnExportarExcel,btnExportarPDF,btnCompartilharZap].forEach(b=>b.disabled=true);
  const numeroPo = input.value.trim();
  if (!numeroPo) return;
  dadosObra = null;
  // Consulta BHMap WFS
  const url = `https://bhmap.pbh.gov.br/arcgis/rest/services/Obras/MapServer/0/query?where=NUMERO_PO=\'${numeroPo}\'&outFields=*&f=json`;
  try {
    const resp = await fetch(url);
    const json = await resp.json();
    if (!json.features || !json.features.length) throw new Error("Obra não encontrada.");
    const props = json.features[0].attributes;
    // Coordenadas
    let x = json.features[0].geometry.x, y = json.features[0].geometry.y;
    const utmX = x, utmY = y;
    // BHMap usa EPSG:31983 (SIRGAS 2000 / UTM zone 23S)
    // Converter para lat/lon aproximado (simplificado)
    const lat = -20 + (y - 7500000) / 111320;
    const lon = -44 + (x - 700000) / (111320 * Math.cos(-20 * Math.PI/180));
    lastCoords = {lat, lon, utmX, utmY};
    dadosObra = props;
    // Mostra resultado
    dadosObraDiv.innerHTML = `<b>Obra:</b> ${props.NOME_PO || numeroPo}<br>` +
      `<b>Status:</b> ${props.STATUS || "N/A"}<br>` +
      `<b>Coordenadas:</b> ${lat.toFixed(6)}, ${lon.toFixed(6)}` +
      `<br><b>UTM:</b> ${utmX}, ${utmY}`;
    // Mapa 2D
    mapa2dDiv.innerHTML = 
      `<div id="mapLeaflet" style="width:100%;height:280px;border-radius:8px;"></div>`;
    setTimeout(() => {
      var map = L.map("mapLeaflet").setView([lat, lon], 18);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
      }).addTo(map);
      L.marker([lat, lon]).addTo(map).bindPopup(`Obra: ${props.NOME_PO || numeroPo}`).openPopup();
    }, 1);
    // QR Code
    const qrUrl = window.location.href + `?obra=${encodeURIComponent(numeroPo)}`;
    qrcodeDiv.innerHTML = "";
    new QRCode(qrcodeDiv, { text: qrUrl, width: 120, height: 120 });
    // Mapa 3D Cesium
    cesiumDiv.innerHTML = ""; // limpo para reinit
    setTimeout(() => {
      if(typeof Cesium!=="undefined") {
        window.CESIUM_BASE_URL = "Build/CesiumUnminified/";
        var viewer = new Cesium.Viewer("cesiumContainer", {
          terrainProvider: Cesium.createWorldTerrain(),
          animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
          sceneModePicker: false, navigationHelpButton: false, homeButton: false
        });
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1200),
          orientation: { heading: Cesium.Math.toRadians(0.0), pitch: Cesium.Math.toRadians(-45.0), roll: 0.0 }
        });
        viewer.entities.add({ position: Cesium.Cartesian3.fromDegrees(lon, lat), point: { pixelSize: 16, color: Cesium.Color.RED }});
      }
    },100);
    resultado.style.display = "";
    [btnExportarHTML,btnExportarExcel,btnExportarPDF,btnCompartilharZap].forEach(b=>b.disabled=false);
    atualizarHistorico(numeroPo);
  } catch (e) {
    erroDiv.innerText = e.message;
    erroDiv.style.display = "";
  }
};

btnExportarHTML.onclick = () => {
  if (!dadosObra || !lastCoords) return;
  const {lat, lon, utmX, utmY} = lastCoords;
  const bhmapUrl = `https://bhmap.pbh.gov.br/bhmap/?x=${utmX}&y=${utmY}&s=12`;
  const html = `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <title>Relatório BHMap QR 3D</title>\n  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />\n  <link href="Build/CesiumUnminified/Widgets/widgets.css" rel="stylesheet">\n  <style> body{font-family:sans-serif;} #mapa2d{width:100%;height:320px;border-radius:8px;} #cesiumContainer{width:100%;height:340px;border-radius:8px;} </style>\n  <!-- Exportado por ChatGPT TESTE UNICO 2024 -->\n</head>\n<body>\n  <h2>Relatório da Obra</h2>\n  <div><b>Obra:</b> ${dadosObra.NOME_PO || "-"}<br>\n      <b>Status:</b> ${dadosObra.STATUS || "-"}<br>\n      <b>Coordenadas:</b> ${lat.toFixed(6)}, ${lon.toFixed(6)}\n  </div>\n  <div id="mapa2d"></div>\n  <div id="cesiumContainer"></div>\n  <div style="margin-top:8px;"><a href="${bhmapUrl}" target="_blank">Ver no BHMap</a></div>\n  <div style="text-align:center;color:#f80;font-size:13px;margin-top:30px;">\n    Exportado por <b>ChatGPT BHMap QR 3D TESTE UNICO</b> (versão exclusiva)\n  </div>\n  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>\n  <script src="Build/CesiumUnminified/Cesium.js"></script>\n  <script>\n    var map = L.map("mapa2d").setView([${lat}, ${lon}], 18);\n    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map);\n    L.marker([${lat}, ${lon}]).addTo(map).bindPopup("Obra: ${dadosObra.NOME_PO || "-"}").openPopup();\n    window.CESIUM_BASE_URL = "Build/CesiumUnminified/";\n    var viewer = new Cesium.Viewer("cesiumContainer", {\n      terrainProvider: Cesium.createWorldTerrain(),\n      animation: false, timeline: false, baseLayerPicker: false, geocoder: false,\n      sceneModePicker: false, navigationHelpButton: false, homeButton: false\n    });\n    viewer.camera.flyTo({\n      destination: Cesium.Cartesian3.fromDegrees(${lon}, ${lat}, 1200),\n      orientation: { heading: Cesium.Math.toRadians(0.0), pitch: Cesium.Math.toRadians(-45.0), roll: 0.0 }\n    });\n    viewer.entities.add({ position: Cesium.Cartesian3.fromDegrees(${lon}, ${lat}), point: { pixelSize: 16, color: Cesium.Color.RED }});\n  </script>\n</body></html>`;
  const blob = new Blob([html], {type: "text/html"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "relatorio_bhmap3d.html";
  a.click();
};

btnExportarExcel.onclick = () => {
  if (!dadosObra) return;
  const ws = XLSX.utils.json_to_sheet([dadosObra]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Obra");
  XLSX.writeFile(wb, "obra.xlsx");
};

btnExportarPDF.onclick = () => {
  alert("Função PDF ainda não implementada! (Sugestão: use imprimir/Salvar como PDF)");
};

btnCompartilharZap.onclick = () => {
  if (!dadosObra) return;
  const txt = `Obra: ${dadosObra.NOME_PO || "-"}\nStatus: ${dadosObra.STATUS || "-"}\n${window.location.href}`;
  window.open("https://wa.me/?text=" + encodeURIComponent(txt));
};


