// Simple PDF export utility using html2canvas and jspdf
export const exportToPDF = async (elementId: string, fileName: string) => {
  try {
    // For now, we'll use a simple approach - download as CSV/JSON
    // Full PDF support would require html2pdf library
    const element = document.getElementById(elementId);
    if (!element) {
      console.error("Element not found");
      return;
    }
    
    // Convert table to CSV if it exists
    const tables = element.querySelectorAll("table");
    if (tables.length > 0) {
      let csvContent = "data:text/csv;charset=utf-8,";
      tables.forEach((table) => {
        const rows = table.querySelectorAll("tr");
        rows.forEach((row) => {
          const cells = row.querySelectorAll("td, th");
          const rowData = Array.from(cells)
            .map((cell) => `"${cell.textContent?.trim()}"`)
            .join(",");
          csvContent += rowData + "\n";
        });
      });
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${fileName}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    
    // Fallback: copy text content
    const text = element.textContent || "";
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Export failed:", error);
  }
};

export const downloadAsJSON = (data: any, fileName: string) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
