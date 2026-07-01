require("dotenv").config();
const mongoose = require("mongoose");
const xlsx = require("xlsx");
const Question = require("../models/Question");

// Convert Excel serial number to JS Date
function excelToJSDate(serial) {
  if (typeof serial === "number") {
    const excelEpoch = new Date(1899, 11, 30); // Excel epoch
    return new Date(excelEpoch.getTime() + serial * 86400000);
  }
  // If already a string, JS Date can parse it
  return new Date(serial);
}

async function loadExcelToMongo() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");

    const workbook = xlsx.readFile("./NYT Trump Articles.xlsx");
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    console.log("First row preview:", rows[0]);

    for (const row of rows) {
      const text = row.Action;
      const excelDate = row["Pub Date"];

      if (!text || text.trim() === "") continue;

      const exists = await Question.findOne({ text });
      if (!exists) {
        await Question.create({
          text,
          pubDate: excelDate ? excelToJSDate(excelDate) : null
        });
      }
    }

    console.log("✔ Questions + Pub Dates loaded successfully!");
    process.exit(0);

  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

loadExcelToMongo();
