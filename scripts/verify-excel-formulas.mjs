import ExcelJS from "exceljs"

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile("/Users/bavaraianecons/Desktop/MonzaHaus-V3-Report-Preview.xlsx")

for (const ws of wb.worksheets) {
  console.log(`\n=== ${ws.name} ===`)
  ws.eachRow((row, rowNum) => {
    row.eachCell((cell, colNum) => {
      const val = cell.value
      const formula = typeof val === "object" && val && "formula" in val ? val.formula : null
      const display = formula
        ? `[FORMULA: ${formula}]`
        : typeof val === "object" && val && "text" in val
          ? `[LINK: ${val.text}]`
          : JSON.stringify(val)
      if (formula || (val != null && val !== "")) {
        console.log(`  ${String.fromCharCode(64 + colNum)}${rowNum}: ${display}`)
      }
    })
  })
}
