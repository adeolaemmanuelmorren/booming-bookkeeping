const PACIFIC_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const REPORT_MODES = new Set(["live", "five-k"]);

export function parseReportSelection(url) {
  const mode = url.searchParams.get("mode");
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!REPORT_MODES.has(mode)) return null;
  if (!PACIFIC_DATETIME.test(start ?? "")) return null;
  if (!PACIFIC_DATETIME.test(end ?? "")) return null;
  if (start >= end) return null;

  return { mode, start, end };
}

function isHourSelected(hour, selection) {
  return hour >= selection.start && hour < selection.end;
}

function isDeliveryDateSelected(date, selection) {
  const startDate = selection.start.slice(0, 10);
  const endDate = selection.end.slice(0, 10);
  return date >= startDate && date < endDate;
}

export function selectCompactReportData(reportData, selection) {
  const selectedLiveRows = reportData.liveRows.filter((row) =>
    isHourSelected(row[0], selection),
  );
  const selectedFiveKRows =
    selection.mode === "five-k"
      ? reportData.fiveKRows.filter((row) =>
          isHourSelected(row[0], selection),
        )
      : [];
  const selectedDimensions = [];
  const selectedDimensionIndexes = new Map();

  function remapRows(rows) {
    return rows.map((row) => {
      const previousIndex = Number(row[1]);
      let selectedIndex = selectedDimensionIndexes.get(previousIndex);

      if (selectedIndex === undefined) {
        selectedIndex = selectedDimensions.length;
        selectedDimensions.push(reportData.adDimensions[previousIndex]);
        selectedDimensionIndexes.set(previousIndex, selectedIndex);
      }

      return [row[0], String(selectedIndex), ...row.slice(2)];
    });
  }

  const liveRows = remapRows(selectedLiveRows);
  const fiveKRows = remapRows(selectedFiveKRows);

  return {
    reportWindow: reportData.reportWindow,
    selectedRange: {
      start: selection.start,
      end: selection.end,
    },
    metaDeliveryDaily: reportData.metaDeliveryDaily.filter((row) =>
      isDeliveryDateSelected(row.date, selection),
    ),
    adDimensions: selectedDimensions,
    liveRows,
    fiveKRows,
  };
}
