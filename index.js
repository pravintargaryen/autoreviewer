require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { exec } = require("child_process");
const path = require("path");

const app = express();
app.use(express.static("public"));
const port = process.env.PORT || 3000;

// Middleware to parse JSON requests
app.use(bodyParser.json());

// Serve static files from the current directory (for styles, scripts, etc.)
app.use(express.static(path.join(__dirname)));

// Serve index.html on the root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Mock data for test cases
const testCases = [
  {
    input: "5\n",
    expected_output: "120\n",
  },
  {
    input: "3\n",
    expected_output: "6\n",
  },
];

// Endpoint to submit code
app.post("/submit-code", async (req, res) => {
  const { code } = req.body;

  try {
    // Run student code with test cases
    const results = await runStudentCode(code, testCases);

    // Get feedback from Mistral AI
    const feedback = await getMistralFeedback(code);

    // Send the response back
    res.json({
      results,
      feedback,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Function to run student's code using Node's child process
function runStudentCode(studentCode, testCases) {
  return new Promise((resolve, reject) => {
    const results = [];
    let completed = 0;

    testCases.forEach((testCase, index) => {
      exec(
        `echo "${testCase.input}" | python3 -c "${studentCode}"`,
        (error, stdout, stderr) => {
          const output = stdout.trim();
          const passed = output === testCase.expected_output.trim();

          results.push({
            input: testCase.input,
            output: output || stderr,
            expected: testCase.expected_output,
            pass: passed,
          });

          if (++completed === testCases.length) {
            resolve(results);
          }
        }
      );
    });
  });
}

// Function to get feedback from Mistral AI
async function getMistralFeedback(code) {
  const mistralApiUrl = "https://api.mistral.ai/v1/chat/completions"; // Replace with the actual Mistral API URL
  const apiKey = process.env.API_KEY; // Replace with your actual Mistral API key

  const payload = {
    model: "mistral-small-latest",
    temperature: 0.7,
    top_p: 1,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Please review the following Python code for correctness, efficiency, and coding style: \n\n${code}`,
      },
    ],
    response_format: {
      type: "text",
    },
  };

  try {
    const response = await axios.post(mistralApiUrl, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error(
      "Error fetching feedback from Mistral:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Could not fetch feedback from Mistral AI");
  }
}

app.get("/", (req, res) => {
  res.sendFile("index.html");
});

// Start the server
app.listen(port, () => {
  console.log(`Autograder app listening at http://localhost:${port}`);
});
