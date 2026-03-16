const CONFIG = {
  dataUrl: "data/commuting_zone_norms_deviation_github.csv",
  delimiter: ";",
  czField: "commuting_zone",
  yearField: "year",
  czLabel: "Commuting zone ID"
};

let allRows = [];
let allCZs = [];
let allYears = [];
let numericMetrics = [];
let chartInstance = null;

async function loadCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      delimiter: CONFIG.delimiter,
      skipEmptyLines: true,
      complete: results => {
        if (results.errors && results.errors.length) {
          reject(new Error(results.errors[0].message));
          return;
        }
        resolve(sanitizeRows(results.data));
      },
      error: error => reject(error)
    });
  });
}

function sanitizeRows(rows) {
  return rows.map(row => {
    const cleanRow = {};
    Object.entries(row).forEach(([key, value]) => {
      const cleanKey = String(key).replace(/^\uFEFF/, "").trim();
      cleanRow[cleanKey] = typeof value === "string" ? value.trim() : value;
    });
    return cleanRow;
  });
}

function uniqueSorted(values, numeric = false) {
  const uniqueValues = [...new Set(values.filter(value => value !== "" && value !== null && value !== undefined))];
  if (numeric) {
    return uniqueValues.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  }
  return uniqueValues.map(String).sort((a, b) => a.localeCompare(b));
}

function normalizeCZ(value) {
  return String(value || "").trim().toLowerCase();
}

function isNumeric(value) {
  if (value === null || value === undefined || value === "") {
    return false;
  }
  const number = Number(value);
  return Number.isFinite(number);
}

function detectNumericMetrics(rows) {
  if (!rows.length) {
    return [];
  }

  const excluded = new Set([CONFIG.czField, CONFIG.yearField, "cz", "year", "cz_id"]);
  return Object.keys(rows[0]).filter(column => {
    if (excluded.has(column)) {
      return false;
    }

    const filledValues = rows.map(row => row[column]).filter(value => value !== "");
    return filledValues.length > 0 && filledValues.every(isNumeric);
  });
}

function fillDatalist(id, values) {
  const datalist = document.getElementById(id);
  datalist.innerHTML = "";

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    datalist.appendChild(option);
  });
}

function fillSelect(id, values) {
  const select = document.getElementById(id);
  select.innerHTML = "";

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function setStatus(message) {
  document.getElementById("status").textContent = message;
}

function getFilters() {
  return {
    cz: String(document.getElementById("czSearch").value || "").trim(),
    startYear: Number(document.getElementById("startYear").value),
    endYear: Number(document.getElementById("endYear").value),
    metric: document.getElementById("metricSelect").value
  };
}

function validateFilters(filters) {
  if (!filters.cz) {
    return `Choose a ${CONFIG.czLabel.toLowerCase()}.`;
  }

  const czExists = allCZs.some(cz => normalizeCZ(cz) === normalizeCZ(filters.cz));
  if (!czExists) {
    return `Choose a ${CONFIG.czLabel.toLowerCase()} from the available list.`;
  }

  if (!Number.isFinite(filters.startYear) || !Number.isFinite(filters.endYear)) {
    return "Choose both a start year and an end year.";
  }

  if (filters.endYear < filters.startYear) {
    return "End year must be at least the start year.";
  }

  if (!filters.metric) {
    return "Choose a metric to plot.";
  }

  return "";
}

function filterRows(rows, filters) {
  return rows.filter(row => {
    const rowCZ = normalizeCZ(row[CONFIG.czField]);
    const year = Number(row[CONFIG.yearField]);

    return rowCZ === normalizeCZ(filters.cz) && year >= filters.startYear && year <= filters.endYear;
  });
}

function rowsToCSV(rows) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(",")];

  rows.forEach(row => {
    const line = headers.map(header => csvEscape(row[header]));
    lines.push(line.join(","));
  });

  return lines.join("\n");
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildYearSeries(rows, metric) {
  const grouped = new Map();

  rows.forEach(row => {
    const year = Number(row[CONFIG.yearField]);
    const value = Number(row[metric]);
    if (!Number.isFinite(year) || !Number.isFinite(value)) {
      return;
    }

    if (!grouped.has(year)) {
      grouped.set(year, []);
    }
    grouped.get(year).push(value);
  });

  return [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, values]) => ({
      year,
      value: values.reduce((sum, current) => sum + current, 0) / values.length
    }));
}

function renderChart(rows, filters) {
  const summary = document.getElementById("chartSummary");
  const canvas = document.getElementById("resultsChart");

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (!rows.length) {
    summary.textContent = "No matching rows to plot.";
    return;
  }

  const series = buildYearSeries(rows, filters.metric);
  if (!series.length) {
    summary.textContent = `Matches found, but "${filters.metric}" is not numeric in the filtered rows.`;
    return;
  }

  chartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels: series.map(point => point.year),
      datasets: [{
        label: `${filters.metric} for ${filters.cz}`,
        data: series.map(point => point.value),
        borderColor: "#246b45",
        backgroundColor: "rgba(36, 107, 69, 0.18)",
        borderWidth: 3,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.25,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Year"
          }
        },
        y: {
          title: {
            display: true,
            text: filters.metric
          }
        }
      }
    }
  });

  summary.textContent = `Showing ${filters.metric} for ${filters.cz} from ${filters.startYear} to ${filters.endYear}.`;
}

function renderPreview(rows) {
  const table = document.getElementById("previewTable");
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  thead.innerHTML = "";
  tbody.innerHTML = "";

  if (!rows.length) {
    tbody.innerHTML = '<tr><td class="empty">No rows to preview.</td></tr>';
    return;
  }

  const headers = Object.keys(rows[0]);
  const headRow = document.createElement("tr");
  headers.forEach(header => {
    const th = document.createElement("th");
    th.textContent = header;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  rows.slice(0, 12).forEach(row => {
    const tr = document.createElement("tr");
    headers.forEach(header => {
      const td = document.createElement("td");
      td.textContent = row[header];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function previewMatches() {
  const filters = getFilters();
  const validationMessage = validateFilters(filters);

  if (validationMessage) {
    setStatus(validationMessage);
    renderPreview([]);
    renderChart([], filters);
    return;
  }

  const matches = filterRows(allRows, filters);
  renderPreview(matches);
  renderChart(matches, filters);
  setStatus(`${matches.length} rows match your filters.`);
}

function handleDownload() {
  const filters = getFilters();
  const validationMessage = validateFilters(filters);

  if (validationMessage) {
    setStatus(validationMessage);
    return;
  }

  const matches = filterRows(allRows, filters);
  if (!matches.length) {
    setStatus("No matching rows found.");
    renderPreview([]);
    renderChart([], filters);
    return;
  }

  const csv = rowsToCSV(matches);
  const filename = `${slugify(filters.cz)}_${filters.startYear}_${filters.endYear}.csv`;
  downloadTextFile(filename, csv);
  setStatus(`Downloaded ${matches.length} rows as ${filename}.`);
}

async function init() {
  try {
    setStatus("Loading data...");
    allRows = await loadCSV(CONFIG.dataUrl);

    if (!allRows.length) {
      setStatus("Dataset is empty.");
      return;
    }

    if (!(CONFIG.czField in allRows[0]) || !(CONFIG.yearField in allRows[0])) {
      setStatus(`CSV must contain columns named "${CONFIG.czField}" and "${CONFIG.yearField}".`);
      return;
    }

    allCZs = uniqueSorted(allRows.map(row => row[CONFIG.czField]));
    allYears = uniqueSorted(allRows.map(row => row[CONFIG.yearField]), true);
    numericMetrics = detectNumericMetrics(allRows);

    if (!numericMetrics.length) {
      setStatus(`CSV needs at least one numeric metric column besides "${CONFIG.czField}" and "${CONFIG.yearField}".`);
      return;
    }

    fillDatalist("czOptions", allCZs);
    fillSelect("startYear", allYears);
    fillSelect("endYear", allYears);
    fillSelect("metricSelect", numericMetrics);

    document.getElementById("startYear").value = allYears[0];
    document.getElementById("endYear").value = allYears[allYears.length - 1];

    document.getElementById("previewBtn").addEventListener("click", previewMatches);
    document.getElementById("downloadBtn").addEventListener("click", handleDownload);

    renderPreview([]);
    setStatus(`Loaded ${allRows.length} rows across ${allCZs.length} commuting zones.`);
  } catch (error) {
    console.error(error);
    setStatus(`Error: ${error.message}`);
  }
}

init();
