
// =====================================================
// CALCULA — LOCAL PERSONAL CALCULATOR
// All calculations run locally in your browser.
// =====================================================

const $ = id => document.getElementById(id);

const storage = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }
};

let expression = "";
let lastResult = "0";
let memory = storage.get("calcMemory", 0);
let history = storage.get("calcHistory", []);
let angleMode = storage.get("calcAngle", "DEG");
let grayMode = "binary";
let gateA = 0;
let gateB = 0;
let equationType = "linear";
let matrixSize = 3;
let toastTimer;


// =====================================================
// GENERAL UTILITIES
// =====================================================

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

function vibrate() {
  try {
    if (navigator.vibrate) navigator.vibrate(10);
  } catch {}
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return "Error";

  if (Object.is(n, -0)) n = 0;

  if (Number.isInteger(n) && Math.abs(n) < 1e15) {
    return n.toString();
  }

  return Number(n.toPrecision(12)).toString();
}

function getNumber(id) {
  return Number($(id).value);
}

function copyText(text) {
  navigator.clipboard?.writeText(String(text))
    .then(() => toast("Copied"))
    .catch(() => toast("Copy unavailable"));
}

function safeParseNumbers(value) {
  const numbers = value
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map(Number);

  if (!numbers.length || numbers.some(n => !Number.isFinite(n))) {
    throw new Error("Enter valid numbers separated by commas.");
  }

  return numbers;
}

function saveSettings() {
  storage.set("calcAngle", angleMode);
  storage.set("calcMemory", memory);
}


// =====================================================
// NAVIGATION
// =====================================================

// =====================================================
// NAVIGATION
// =====================================================

document.querySelectorAll(".nav-btn").forEach(button => {
    button.addEventListener("click", () => {
        const targetPage = document.getElementById(button.dataset.page);

        if (!targetPage) {
            console.error("Page not found:", button.dataset.page);
            return;
        }

        document.querySelectorAll(".nav-btn").forEach(btn => {
            btn.classList.remove("active");
        });

        document.querySelectorAll(".page").forEach(page => {
            page.classList.remove("active");
        });

        button.classList.add("active");
        targetPage.classList.add("active");

        // Close menu
        const overlay = document.getElementById("menuOverlay");

        if (overlay) {
            overlay.classList.add("hidden");
            overlay.classList.remove("open");
        }

        document.body.style.overflow = "";

        vibrate();
    });
});

// =====================================================
// THEME
// =====================================================

/* ==========================
   THEME INITIALIZATION
========================== */

const savedTheme = storage.get("calcTheme", "dark");

if (savedTheme === "light") {
    document.body.classList.add("light");
}

// =====================================================
// EXPRESSION PARSER
// No eval() used.
// Supports arithmetic, functions, parentheses, constants.
// =====================================================

function tokenize(input) {
  input = input
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-")
    .replaceAll("π", "pi")
    .replace(/\s+/g, "");

  const tokens = input.match(
    /(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-zA-Z]+|[+\-*/^()%]/gi
  );

  if (!tokens || tokens.join("") !== input) {
    throw new Error("Invalid expression");
  }

  return tokens;
}

function calculateExpression(input) {
  const tokens = tokenize(input);
  let pos = 0;

  function peek() {
    return tokens[pos];
  }

  function consume() {
    return tokens[pos++];
  }

  function expression() {
    let value = term();

    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = term();
      value = op === "+" ? value + right : value - right;
    }

    return value;
  }

  function term() {
    let value = power();

    while (peek() === "*" || peek() === "/") {
      const op = consume();
      const right = power();

      if (op === "/" && right === 0) {
        throw new Error("Division by zero");
      }

      value = op === "*" ? value * right : value / right;
    }

    return value;
  }

  function power() {
    let value = unary();

    if (peek() === "^") {
      consume();
      value = Math.pow(value, power());
    }

    return value;
  }

  function unary() {
    if (peek() === "+") {
      consume();
      return unary();
    }

    if (peek() === "-") {
      consume();
      return -unary();
    }

    return primary();
  }

  function primary() {
    const token = consume();

    if (token === undefined) throw new Error("Incomplete expression");

    if (token === "(") {
      const value = expression();

      if (consume() !== ")") {
        throw new Error("Missing closing bracket");
      }

      return value;
    }

    if (token === "pi") return Math.PI;
    if (token === "e") return Math.E;

    if (/^\d/.test(token) || /^\.\d/.test(token)) {
      return Number(token);
    }

    if (/^[a-zA-Z]+$/.test(token)) {
      const name = token.toLowerCase();

      if (consume() !== "(") {
        throw new Error("Function needs parentheses");
      }

      const value = expression();

      if (consume() !== ")") {
        throw new Error("Missing closing bracket");
      }

      const rad = angleMode === "DEG" ? value * Math.PI / 180 : value;

      const funcs = {
        sin: () => Math.sin(rad),
        cos: () => Math.cos(rad),
        tan: () => Math.tan(rad),
        asin: () => angleMode === "DEG" ? Math.asin(value) * 180 / Math.PI : Math.asin(value),
        acos: () => angleMode === "DEG" ? Math.acos(value) * 180 / Math.PI : Math.acos(value),
        atan: () => angleMode === "DEG" ? Math.atan(value) * 180 / Math.PI : Math.atan(value),
        sqrt: () => Math.sqrt(value),
        log: () => Math.log10(value),
        ln: () => Math.log(value),
        abs: () => Math.abs(value),
        floor: () => Math.floor(value),
        ceil: () => Math.ceil(value),
        round: () => Math.round(value),
        factorial: () => factorial(value)
      };

      if (!funcs[name]) throw new Error("Unknown function: " + name);

      return funcs[name]();
    }

    throw new Error("Invalid input");
  }

  function factorial(n) {
    if (!Number.isInteger(n) || n < 0 || n > 170) {
      throw new Error("Factorial requires an integer from 0 to 170");
    }

    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  let value = expression();

  // Postfix percentage
  while (peek() === "%") {
    consume();
    value /= 100;
  }

  if (pos < tokens.length) {
    throw new Error("Unexpected input");
  }

  if (!Number.isFinite(value)) {
    throw new Error("Invalid result");
  }

  return value;
}


// =====================================================
// MAIN CALCULATOR
// =====================================================

function updateDisplay() {
  $("expression").textContent = expression || "0";

  try {
    if (!expression) {
      $("result").textContent = "0";
      return;
    }

    $("result").textContent = formatNumber(calculateExpression(expression));
  } catch {
    $("result").textContent = "";
  }
}

function insertCalc(value) {
    if (expression === "Error") {
        expression = "";
    }

    if (value === "π") {
        value = "pi";
    }

    // Insert multiplication for common cases
    const needsMultiplication =
        /[0-9.)]$/.test(expression) &&
        /^[a-zA-Z(]/.test(value);

    if (needsMultiplication) {
        expression += "*";
    }

    expression += value;

    updateDisplay();
    vibrate();
}

function clearCalc() {
  expression = "";
  lastResult = "0";
  updateDisplay();
}

function backspace() {
  expression = expression.slice(0, -1);
  updateDisplay();
}

function toggleSign() {
  if (!expression) {
    expression = "-";
  } else if (expression.startsWith("-")) {
    expression = expression.slice(1);
  } else {
    expression = "-" + expression;
  }

  updateDisplay();
}

function calculate() {
  if (!expression) return;

  try {
    const answer = calculateExpression(expression);
    lastResult = formatNumber(answer);

    addHistory(expression, lastResult);

    expression = lastResult;
    updateDisplay();
    toast("Calculated");
    vibrate();
  } catch (error) {
    $("result").textContent = "Error";
    toast(error.message);
  }
}

document.querySelectorAll("[data-calc]").forEach(button => {
  button.addEventListener("click", () => insertCalc(button.dataset.calc));
});

document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;

    if (action === "clear") clearCalc();
    if (action === "backspace") backspace();
    if (action === "sign") toggleSign();
    if (action === "equals") calculate();
  });
});

// =====================================================
// KEYBOARD INPUT
// =====================================================

document.addEventListener("keydown", event => {
  if (
    event.target.matches("input, select") ||
    $("historyModal").classList.contains("hidden") === false
  ) {
    return;
  }

  if (/^[0-9.]$/.test(event.key)) insertCalc(event.key);
  else if (["+", "-", "*", "/", "^", "%", "(", ")"].includes(event.key)) {
    insertCalc(event.key);
  }
  else if (event.key === "Enter" || event.key === "=") {
    event.preventDefault();
    calculate();
  }
  else if (event.key === "Backspace") {
    backspace();
  }
  else if (event.key === "Escape") {
    clearCalc();
  }
});


// =====================================================
// MEMORY
// =====================================================

document.querySelectorAll("[data-memory]").forEach(button => {
  button.addEventListener("click", () => {
    const action = button.dataset.memory;
    let current;

    try {
      current = calculateExpression(expression || lastResult);
    } catch {
      current = Number(lastResult);
    }

    if (action === "MC") memory = 0;
    if (action === "MR") expression += String(memory);
    if (action === "M+") memory += current;
    if (action === "M-") memory -= current;

    saveSettings();
    updateDisplay();
    toast("Memory: " + formatNumber(memory));
  });
});

$("copyBtn").addEventListener("click", () => {
  copyText(lastResult);
});


// =====================================================
// HISTORY
// =====================================================

function addHistory(exp, result) {
  history.unshift({
    exp,
    result,
    time: Date.now()
  });

  history = history.slice(0, 100);
  storage.set("calcHistory", history);
  renderHistory();
}

function renderHistory() {
  const containers = [$("recentHistory"), $("fullHistory")];

  containers.forEach(container => {
    container.innerHTML = "";

    history.forEach(item => {
      const div = document.createElement("div");
      div.className = "history-item";

      const exp = document.createElement("div");
      exp.className = "h-expression";
      exp.textContent = item.exp;

      const result = document.createElement("div");
      result.className = "h-result";
      result.textContent = item.result;

      div.append(exp, result);

      div.addEventListener("click", () => {
        expression = item.exp;
        lastResult = item.result;
        updateDisplay();
        $("historyModal").classList.add("hidden");
        toast("Calculation restored");
      });

      container.appendChild(div);
    });
  });
}

const historyButton = $("historyBtn");

if (historyButton) {
    historyButton.addEventListener("click", () => {
        $("historyModal").classList.remove("hidden");
    });
}
$("viewHistory").addEventListener("click", () => {
  $("historyModal").classList.remove("hidden");
});

$("closeHistory").addEventListener("click", () => {
  $("historyModal").classList.add("hidden");
});

$("historyModal").addEventListener("click", event => {
  if (event.target === $("historyModal")) {
    $("historyModal").classList.add("hidden");
  }
});

$("clearHistory").addEventListener("click", () => {
  history = [];
  storage.set("calcHistory", history);
  renderHistory();
  toast("History cleared");
});

renderHistory();


// =====================================================
// PROGRAMMER CALCULATOR
// =====================================================

function updateProgrammer() {
  const base = Number($("progBase").value);
  const input = $("progInput").value.trim();

  try {
    if (!input) throw new Error();

    const value = parseInt(input, base);

    if (!Number.isFinite(value)) throw new Error();

    $("progDec").textContent = value.toString(10);
    $("progBin").textContent = value.toString(2);
    $("progOct").textContent = value.toString(8);
    $("progHex").textContent = value.toString(16).toUpperCase();
  } catch {
    ["progDec", "progBin", "progOct", "progHex"].forEach(id => {
      $(id).textContent = "Invalid";
    });
  }
}

$("progBase").addEventListener("change", updateProgrammer);
$("progInput").addEventListener("input", updateProgrammer);

updateProgrammer();

document.querySelectorAll("[data-copy]").forEach(button => {
  button.addEventListener("click", () => copyText($(button.dataset.copy).textContent));
});


// =====================================================
// BITWISE CALCULATOR
// =====================================================

document.querySelectorAll("[data-bit]").forEach(button => {
  button.addEventListener("click", () => {
    const a = getNumber("bitA") | 0;
    const b = getNumber("bitB") | 0;
    const operation = button.dataset.bit;

    let result;

    switch (operation) {
      case "AND": result = a & b; break;
      case "OR": result = a | b; break;
      case "XOR": result = a ^ b; break;
      case "NOT": result = ~a; break;
      case "LSHIFT": result = a << 1; break;
      case "RSHIFT": result = a >> 1; break;
    }

    $("bitResult").innerHTML =
      `<b>${operation}</b><br>
       Decimal: ${result}<br>
       Binary: ${(result >>> 0).toString(2)}<br>
       Hex: ${(result >>> 0).toString(16).toUpperCase()}`;

    vibrate();
  });
});


// =====================================================
// COMPLEMENT CALCULATOR
// =====================================================

function updateComplement() {
  const input = $("compInput").value.trim();
  const width = Number($("compWidth").value);

  if (!/^[01]+$/.test(input) || input.length > width) {
    $("onesComp").textContent = "Invalid input";
    $("twosComp").textContent = "Invalid input";
    return;
  }

  const padded = input.padStart(width, "0");
  const ones = padded.replace(/[01]/g, bit => bit === "0" ? "1" : "0");

  let carry = 1;
  let twos = "";

  for (let i = ones.length - 1; i >= 0; i--) {
    const bit = Number(ones[i]) + carry;
    twos = (bit % 2) + twos;
    carry = Math.floor(bit / 2);
  }

  $("onesComp").textContent = ones;
  $("twosComp").textContent = twos;
}

$("compInput").addEventListener("input", updateComplement);
$("compWidth").addEventListener("change", updateComplement);
updateComplement();


// =====================================================
// GRAY CODE
// =====================================================

function binaryToGray(binary) {
  let gray = binary[0];

  for (let i = 1; i < binary.length; i++) {
    gray += Number(binary[i - 1] !== binary[i]);
  }

  return gray;
}

function grayToBinary(gray) {
  let binary = gray[0];
  let previous = Number(gray[0]);

  for (let i = 1; i < gray.length; i++) {
    previous ^= Number(gray[i]);
    binary += previous;
  }

  return binary;
}

function updateGray() {
  const input = $("grayInput").value.trim();

  if (!/^[01]+$/.test(input)) {
    $("grayOutput").textContent = "Enter binary digits only";
    $("graySteps").innerHTML = "";
    return;
  }

  let output;
  let steps = [];

  if (grayMode === "binary") {
    output = binaryToGray(input);

    steps.push(`First bit remains the same: ${input[0]}`);

    for (let i = 1; i < input.length; i++) {
      const a = Number(input[i - 1]);
      const b = Number(input[i]);
      steps.push(`${a} XOR ${b} = ${a ^ b}`);
    }
  } else {
    output = grayToBinary(input);

    steps.push(`First bit remains the same: ${input[0]}`);

    for (let i = 1; i < input.length; i++) {
      steps.push(
        `${output[i - 1]} XOR ${input[i]} = ${output[i]}`
      );
    }
  }

  $("grayOutput").textContent = output;

  $("graySteps").innerHTML = steps
    .map(step => `<div class="step">${step}</div>`)
    .join("");
}

document.querySelectorAll("[data-gray-mode]").forEach(button => {
  button.addEventListener("click", () => {
    grayMode = button.dataset.grayMode;

    document.querySelectorAll("[data-gray-mode]")
      .forEach(b => b.classList.remove("active"));

    button.classList.add("active");

    if (grayMode === "binary") {
      $("grayLabel").textContent = "Binary input";
      $("grayOutputLabel").textContent = "Gray code";
      $("grayExplanation").textContent =
        "Keep the first binary bit. XOR each bit with the bit immediately before it.";
    } else {
      $("grayLabel").textContent = "Gray code input";
      $("grayOutputLabel").textContent = "Binary output";
      $("grayExplanation").textContent =
        "Keep the first Gray bit. XOR each Gray bit with the previous binary bit.";
    }

    updateGray();
  });
});

$("grayInput").addEventListener("input", updateGray);
$("grayConvert").addEventListener("click", updateGray);

function renderGrayReference() {
  const tbody = $("grayReference");
  tbody.innerHTML = "";

  for (let i = 0; i < 16; i++) {
    const binary = i.toString(2).padStart(4, "0");
    const gray = binaryToGray(binary);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${i}</td>
      <td>${binary}</td>
      <td>${gray}</td>
    `;

    tbody.appendChild(row);
  }
}

renderGrayReference();
updateGray();


// =====================================================
// LOGIC GATES
// =====================================================

function gateResult(gate, a, b) {
  switch (gate) {
    case "AND": return a & b;
    case "OR": return a | b;
    case "NOT": return a ? 0 : 1;
    case "NAND": return (a & b) ? 0 : 1;
    case "NOR": return (a | b) ? 0 : 1;
    case "XOR": return a ^ b;
    case "XNOR": return a === b ? 1 : 0;
    default: return 0;
  }
}

function updateGate() {
  const gate = $("gateSelect").value;

  $("gateA").textContent = gateA;
  $("gateB").textContent = gateB;

  $("gateBWrap").style.display = gate === "NOT" ? "none" : "";

  const result = gateResult(gate, gateA, gateB);

  $("gateSymbol").textContent = gate;
  $("gateOutput").textContent = result;

  const tbody = $("gateTable");
  tbody.innerHTML = "";

  const inputs = gate === "NOT" ? [[0], [1]] : [[0,0],[0,1],[1,0],[1,1]];

  inputs.forEach(([a,b]) => {
    const row = document.createElement("tr");

    if (gate === "NOT") {
      row.innerHTML = `<td>${a}</td><td>—</td><td>${gateResult(gate,a,b)}</td>`;
    } else {
      row.innerHTML = `<td>${a}</td><td>${b}</td><td>${gateResult(gate,a,b)}</td>`;
    }

    tbody.appendChild(row);
  });
}

$("gateA").addEventListener("click", () => {
  gateA = gateA ? 0 : 1;
  updateGate();
});

$("gateB").addEventListener("click", () => {
  gateB = gateB ? 0 : 1;
  updateGate();
});

$("gateSelect").addEventListener("change", updateGate);
updateGate();


// =====================================================
// BOOLEAN EXPRESSION PARSER / TRUTH TABLE
// Supports AND, OR, XOR, NOT, parentheses.
// =====================================================

function booleanTokens(input) {
  const text = input.toUpperCase()
    .replace(/\b&&\b/g, " AND ")
    .replace(/\b\|\|\b/g, " OR ")
    .replace(/!/g, " NOT ")
    .replace(/\s+/g, " ")
    .trim();

  return text.match(/\bAND\b|\bOR\b|\bXOR\b|\bNOT\b|[ABC()]|[01]/g) || [];
}

function evaluateBoolean(input, values) {
  let tokens = booleanTokens(input);
  let pos = 0;

  function peek() {
    return tokens[pos];
  }

  function consume() {
    return tokens[pos++];
  }

  function parseOr() {
    let value = parseXor();

    while (peek() === "OR") {
      consume();
      value = value | parseXor();
    }

    return value;
  }

  function parseXor() {
    let value = parseAnd();

    while (peek() === "XOR") {
      consume();
      value = value ^ parseAnd();
    }

    return value;
  }

  function parseAnd() {
    let value = parseUnary();

    while (peek() === "AND") {
      consume();
      value = value & parseUnary();
    }

    return value;
  }

  function parseUnary() {
    if (peek() === "NOT") {
      consume();
      return parseUnary() ? 0 : 1;
    }

    return parsePrimary();
  }

  function parsePrimary() {
    const token = consume();

    if (token === "(") {
      const value = parseOr();

      if (consume() !== ")") {
        throw new Error("Missing bracket");
      }

      return value;
    }

    if (token === "0" || token === "1") return Number(token);
    if (["A", "B", "C"].includes(token)) return values[token];

    throw new Error("Invalid Boolean expression");
  }

  const result = parseOr();

  if (pos !== tokens.length) {
    throw new Error("Invalid expression");
  }

  return result;
}

$("generateTruth").addEventListener("click", () => {
  try {
    const input = $("booleanExpression").value.toUpperCase();

    const variables = [...new Set(input.match(/[ABC]/g) || [])]
      .sort();

    if (!variables.length) throw new Error("Use A, B or C.");

    if (variables.length > 3) throw new Error("Maximum 3 variables.");

    const head = $("truthHead");
    const body = $("truthBody");

    head.innerHTML = "";
    body.innerHTML = "";

    const tr = document.createElement("tr");

    variables.forEach(v => {
      const th = document.createElement("th");
      th.textContent = v;
      tr.appendChild(th);
    });

    const resultTh = document.createElement("th");
    resultTh.textContent = "Result";
    tr.appendChild(resultTh);
    head.appendChild(tr);

    for (let i = 0; i < Math.pow(2, variables.length); i++) {
      const values = {};

      variables.forEach((v, index) => {
        values[v] = (i >> (variables.length - index - 1)) & 1;
      });

      const result = evaluateBoolean(input, values);

      const row = document.createElement("tr");

      variables.forEach(v => {
        const td = document.createElement("td");
        td.textContent = values[v];
        row.appendChild(td);
      });

      const resultTd = document.createElement("td");
      resultTd.textContent = result;
      row.appendChild(resultTd);

      body.appendChild(row);
    }

    $("truthError").textContent = "";
  } catch (error) {
    $("truthError").textContent = error.message;
  }
});

document.querySelectorAll("[data-bool]").forEach(button => {
  button.addEventListener("click", () => {
    const input = $("booleanExpression");
    input.value += button.dataset.bool;
    input.focus();
  });
});


// =====================================================
// MATRIX CALCULATOR
// =====================================================

function createMatrixInputs() {
  matrixSize = Number($("matrixSize").value);

  ["matrixA", "matrixB"].forEach(id => {
    const container = $(id);
    container.innerHTML = "";
    container.style.gridTemplateColumns = `repeat(${matrixSize}, 1fr)`;

    for (let i = 0; i < matrixSize * matrixSize; i++) {
      const input = document.createElement("input");
      input.type = "number";
      input.value = i % (matrixSize + 1) === 0 ? 1 : 0;
      input.dataset.index = i;
      container.appendChild(input);
    }
  });
}

function readMatrix(id) {
  const inputs = [...$(id).querySelectorAll("input")];

  const values = inputs.map(input => Number(input.value));

  if (values.some(v => !Number.isFinite(v))) {
    throw new Error("Enter valid matrix values.");
  }

  const n = matrixSize;

  return Array.from({ length: n }, (_, r) =>
    values.slice(r * n, (r + 1) * n)
  );
}

function matrixTranspose(A) {
  return A[0].map((_, c) => A.map(row => row[c]));
}

function matrixAdd(A, B) {
  return A.map((row, r) => row.map((v, c) => v + B[r][c]));
}

function matrixSubtract(A, B) {
  return A.map((row, r) => row.map((v, c) => v - B[r][c]));
}

function matrixMultiply(A, B) {
  const n = A.length;

  return A.map(row =>
    B[0].map((_, c) =>
      row.reduce((sum, v, k) => sum + v * B[k][c], 0)
    )
  );
}

function determinant(A) {
  const n = A.length;

  if (n === 1) return A[0][0];

  if (n === 2) {
    return A[0][0] * A[1][1] - A[0][1] * A[1][0];
  }

  let result = 0;

  for (let c = 0; c < n; c++) {
    const minor = A.slice(1).map(row =>
      row.filter((_, index) => index !== c)
    );

    result += (c % 2 === 0 ? 1 : -1) *
      A[0][c] * determinant(minor);
  }

  return result;
}

function inverseMatrix(A) {
  const n = A.length;

  const det = determinant(A);

  if (Math.abs(det) < 1e-12) {
    throw new Error("Matrix is singular; inverse does not exist.");
  }

  const augmented = A.map((row, i) =>
    [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]
  );

  for (let i = 0; i < n; i++) {
    let pivot = i;

    for (let r = i + 1; r < n; r++) {
      if (Math.abs(augmented[r][i]) > Math.abs(augmented[pivot][i])) {
        pivot = r;
      }
    }

    [augmented[i], augmented[pivot]] = [augmented[pivot], augmented[i]];

    const divisor = augmented[i][i];

    for (let c = 0; c < 2 * n; c++) {
      augmented[i][c] /= divisor;
    }

    for (let r = 0; r < n; r++) {
      if (r === i) continue;

      const factor = augmented[r][i];

      for (let c = 0; c < 2 * n; c++) {
        augmented[r][c] -= factor * augmented[i][c];
      }
    }
  }

  return augmented.map(row => row.slice(n));
}

function matrixHTML(A) {
  return A.map(row =>
    row.map(v => formatNumber(v)).join("   ")
  ).join("<br>");
}

$("matrixSize").addEventListener("change", createMatrixInputs);
createMatrixInputs();

document.querySelectorAll("[data-matrix]").forEach(button => {
  button.addEventListener("click", () => {
    try {
      const A = readMatrix("matrixA");
      const B = readMatrix("matrixB");
      const op = button.dataset.matrix;

      let result;

      if (op === "ADD") result = matrixAdd(A, B);
      if (op === "SUB") result = matrixSubtract(A, B);
      if (op === "MUL") result = matrixMultiply(A, B);
      if (op === "TA") result = matrixTranspose(A);
      if (op === "TB") result = matrixTranspose(B);
      if (op === "DA") result = determinant(A);
      if (op === "DB") result = determinant(B);
      if (op === "IA") result = inverseMatrix(A);
      if (op === "IB") result = inverseMatrix(B);

      if (typeof result === "number") {
        $("matrixResult").innerHTML =
          `<strong>${formatNumber(result)}</strong>`;
      } else {
        $("matrixResult").innerHTML = matrixHTML(result);
      }
    } catch (error) {
      $("matrixResult").textContent = error.message;
    }
  });
});


// =====================================================
// MATH TOOLS TABS
// =====================================================

document.querySelectorAll("[data-math-mode]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-math-mode]").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".math-panel").forEach(p => p.classList.remove("active"));

    button.classList.add("active");
    $(button.dataset.mathMode + "Panel").classList.add("active");
  });
});


// =====================================================
// STATISTICS
// =====================================================

$("calculateStats").addEventListener("click", () => {
  try {
    const numbers = safeParseNumbers($("statsInput").value);
    const sorted = [...numbers].sort((a, b) => a - b);
    const n = numbers.length;
    const sum = numbers.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    const median = n % 2
      ? sorted[Math.floor(n / 2)]
      : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

    const frequency = {};

    numbers.forEach(n => {
      frequency[n] = (frequency[n] || 0) + 1;
    });

    const maxFrequency = Math.max(...Object.values(frequency));
    const modes = Object.keys(frequency)
      .filter(k => frequency[k] === maxFrequency);

    const mode = maxFrequency === 1 ? "No mode" : modes.join(", ");

    const variance = numbers.reduce(
      (sum, n) => sum + Math.pow(n - mean, 2), 0
    ) / n;

    $("statCount").textContent = n;
    $("statSum").textContent = formatNumber(sum);
    $("statMean").textContent = formatNumber(mean);
    $("statMedian").textContent = formatNumber(median);
    $("statMode").textContent = mode;
    $("statRange").textContent = formatNumber(sorted[n - 1] - sorted[0]);
    $("statVariance").textContent = formatNumber(variance);
    $("statSD").textContent = formatNumber(Math.sqrt(variance));
  } catch (error) {
    toast(error.message);
  }
});


// =====================================================
// EQUATION SOLVER
// =====================================================

document.querySelectorAll("[data-equation-type]").forEach(button => {
  button.addEventListener("click", () => {
    equationType = button.dataset.equationType;

    document.querySelectorAll("[data-equation-type]")
      .forEach(b => b.classList.remove("active"));

    button.classList.add("active");

    $("linearInputs").classList.toggle("hidden", equationType !== "linear");
    $("quadraticInputs").classList.toggle("hidden", equationType !== "quadratic");
  });
});

$("solveEquation").addEventListener("click", () => {
  try {
    if (equationType === "linear") {
      const a = getNumber("linearA");
      const b = getNumber("linearB");

      if (a === 0) {
        throw new Error(a === 0 && b === 0
          ? "Infinite solutions"
          : "No solution");
      }

      const x = -b / a;

      $("equationResult").innerHTML =
        `x = <strong>${formatNumber(x)}</strong><br>
         Substitution: ${a}x + ${b} = 0<br>
         x = −b/a`;
    } else {
      const a = getNumber("quadA");
      const b = getNumber("quadB");
      const c = getNumber("quadC");

      if (a === 0) throw new Error("a cannot be zero.");

      const d = b * b - 4 * a * c;

      if (d >= 0) {
        const x1 = (-b + Math.sqrt(d)) / (2 * a);
        const x2 = (-b - Math.sqrt(d)) / (2 * a);

        $("equationResult").innerHTML =
          `Discriminant = ${formatNumber(d)}<br>
           x₁ = <strong>${formatNumber(x1)}</strong><br>
           x₂ = <strong>${formatNumber(x2)}</strong>`;
      } else {
        const real = -b / (2 * a);
        const imaginary = Math.sqrt(-d) / (2 * a);

        $("equationResult").innerHTML =
          `Discriminant = ${formatNumber(d)}<br>
           x₁ = ${formatNumber(real)} + ${formatNumber(imaginary)}i<br>
           x₂ = ${formatNumber(real)} − ${formatNumber(imaginary)}i`;
      }
    }
  } catch (error) {
    $("equationResult").textContent = error.message;
  }
});


// =====================================================
// FACTORIAL / PERMUTATIONS / COMBINATIONS
// =====================================================

function factorial(n) {
  if (!Number.isInteger(n) || n < 0 || n > 170) {
    throw new Error("Use an integer between 0 and 170.");
  }

  let result = 1;

  for (let i = 2; i <= n; i++) result *= i;

  return result;
}

$("calculateProb").addEventListener("click", () => {
  try {
    const n = getNumber("probN");
    const r = getNumber("probR");

    if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) {
      throw new Error("Require integers where 0 ≤ r ≤ n.");
    }

    $("factorialResult").textContent = formatNumber(factorial(n));
    $("permutationResult").textContent =
      formatNumber(factorial(n) / factorial(n - r));

    $("combinationResult").textContent =
      formatNumber(factorial(n) / (factorial(r) * factorial(n - r)));
  } catch (error) {
    toast(error.message);
  }
});


// =====================================================
// COMPLEX NUMBERS
// =====================================================

document.querySelectorAll("[data-complex]").forEach(button => {
  button.addEventListener("click", () => {
    const ar = getNumber("complexAR");
    const ai = getNumber("complexAI");
    const br = getNumber("complexBR");
    const bi = getNumber("complexBI");

    const op = button.dataset.complex;

    let real, imaginary;

    if (op === "ADD") {
      real = ar + br;
      imaginary = ai + bi;
    }

    if (op === "SUB") {
      real = ar - br;
      imaginary = ai - bi;
    }

    if (op === "MUL") {
      real = ar * br - ai * bi;
      imaginary = ar * bi + ai * br;
    }

    if (op === "DIV") {
      const denominator = br * br + bi * bi;

      if (denominator === 0) {
        $("complexResult").textContent = "Division by zero";
        return;
      }

      real = (ar * br + ai * bi) / denominator;
      imaginary = (ai * br - ar * bi) / denominator;
    }

    $("complexResult").innerHTML =
      `Real: <strong>${formatNumber(real)}</strong><br>
       Imaginary: <strong>${formatNumber(imaginary)}</strong><br>
       Complex form: ${formatNumber(real)} ${imaginary >= 0 ? "+" : "−"} ${formatNumber(Math.abs(imaginary))}i`;
  });
});


// =====================================================
// FRACTIONS
// =====================================================

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);

  while (b) {
    [a, b] = [b, a % b];
  }

  return a || 1;
}

document.querySelectorAll("[data-fraction]").forEach(button => {
  button.addEventListener("click", () => {
    let a = getNumber("fracA");
    let b = getNumber("fracB");
    let c = getNumber("fracC");
    let d = getNumber("fracD");

    if (!b || !d) {
      $("fractionResult").textContent = "Denominator cannot be zero.";
      return;
    }

    const op = button.dataset.fraction;

    let numerator, denominator;

    if (op === "ADD") {
      numerator = a * d + c * b;
      denominator = b * d;
    }

    if (op === "SUB") {
      numerator = a * d - c * b;
      denominator = b * d;
    }

    if (op === "MUL") {
      numerator = a * c;
      denominator = b * d;
    }

    if (op === "DIV") {
      if (c === 0) {
        $("fractionResult").textContent = "Cannot divide by zero.";
        return;
      }

      numerator = a * d;
      denominator = b * c;
    }

    if (denominator < 0) {
      numerator *= -1;
      denominator *= -1;
    }

    const divisor = gcd(numerator, denominator);
    numerator /= divisor;
    denominator /= divisor;

    $("fractionResult").innerHTML =
      `<strong>${numerator}/${denominator}</strong><br>
       Decimal: ${formatNumber(numerator / denominator)}`;
  });
});


// =====================================================
// COLLEGE TOOLS
// =====================================================

document.querySelectorAll("[data-college-mode]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-college-mode]").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".college-panel").forEach(p => p.classList.remove("active"));

    button.classList.add("active");
    $(button.dataset.collegeMode + "Panel").classList.add("active");
  });
});


// Marks

$("calculateMarks").addEventListener("click", () => {
  const obtained = getNumber("marksObtained");
  const total = getNumber("marksTotal");

  if (total <= 0 || obtained < 0 || obtained > total) {
    $("marksResult").textContent = "Enter valid marks.";
    return;
  }

  const percentage = obtained / total * 100;

  $("marksResult").innerHTML =
    `Percentage: <strong>${formatNumber(percentage)}%</strong>`;
});


// Attendance

$("calculateAttendance").addEventListener("click", () => {
  const attended = getNumber("attended");
  const conducted = getNumber("conducted");
  const required = getNumber("requiredAttendance");

  if (
    conducted <= 0 ||
    attended < 0 ||
    attended > conducted ||
    required < 0 ||
    required > 100
  ) {
    $("attendanceResult").textContent = "Enter valid attendance.";
    return;
  }

  const percentage = attended / conducted * 100;

  let message = `Current attendance: ${formatNumber(percentage)}%`;

  if (percentage >= required) {
    const maxMiss = Math.floor((attended * 100 / required) - conducted);

    message += `<br>You may miss approximately ${Math.max(0, maxMiss)} additional classes and remain at the required percentage.`;
  } else {
    const need = Math.ceil(
      (required * conducted - 100 * attended) / (100 - required)
    );

    message += `<br>Attend the next ${Math.max(0, need)} classes consecutively to reach ${required}%.`;
  }

  $("attendanceResult").innerHTML = message;
});


// Exam target

$("calculateTarget").addEventListener("click", () => {
  const current = getNumber("targetCurrent");
  const total = getNumber("targetTotal");
  const target = getNumber("targetPercent");

  if (
    total <= 0 ||
    current < 0 ||
    current > total ||
    target < 0 ||
    target > 100
  ) {
    $("targetResult").textContent = "Enter valid values.";
    return;
  }

  const required = total * target / 100;

  $("targetResult").innerHTML =
    `Marks needed: <strong>${formatNumber(required)}</strong><br>
     Remaining marks to target: <strong>${formatNumber(Math.max(0, required - current))}</strong><br>
     Current percentage: ${formatNumber(current / total * 100)}%`;
});


// GPA rows

function addGpaRow() {
  const row = document.createElement("div");
  row.className = "three-inputs gpa-row";
  row.style.marginTop = "8px";

  row.innerHTML = `
    <input type="number" placeholder="Grade points" value="8" step="0.1">
    <input type="number" placeholder="Credits" value="3">
    <button class="tool-button remove-gpa">✕</button>
  `;

  row.querySelector(".remove-gpa").addEventListener("click", () => row.remove());

  $("gpaRows").appendChild(row);
}

$("addGpaRow").addEventListener("click", addGpaRow);

addGpaRow();
addGpaRow();
addGpaRow();

$("calculateGpa").addEventListener("click", () => {
  const rows = [...document.querySelectorAll(".gpa-row")];

  let weighted = 0;
  let credits = 0;

  rows.forEach(row => {
    const inputs = row.querySelectorAll("input");
    const grade = Number(inputs[0].value);
    const credit = Number(inputs[1].value);

    if (grade >= 0 && credit > 0) {
      weighted += grade * credit;
      credits += credit;
    }
  });

  if (!credits) {
    $("gpaResult").textContent = "Enter grades and credits.";
    return;
  }

  $("gpaResult").innerHTML =
    `Total credits: ${credits}<br>
     GPA: <strong>${formatNumber(weighted / credits)}</strong>`;
});


// =====================================================
// UNIT CONVERTER
// =====================================================

const units = {
  length: {
    Meter: 1,
    Kilometer: 1000,
    Centimeter: .01,
    Millimeter: .001,
    Mile: 1609.344,
    Yard: .9144,
    Foot: .3048,
    Inch: .0254
  },

  mass: {
    Kilogram: 1,
    Gram: .001,
    Milligram: .000001,
    Pound: .45359237,
    Ounce: .028349523125,
    Tonne: 1000
  },

  time: {
    Second: 1,
    Millisecond: .001,
    Minute: 60,
    Hour: 3600,
    Day: 86400
  },

  area: {
    "Square meter": 1,
    "Square kilometer": 1000000,
    "Square centimeter": .0001,
    "Square foot": .09290304,
    Acre: 4046.8564224,
    Hectare: 10000
  },

  volume: {
    Liter: 1,
    Milliliter: .001,
    "Cubic meter": 1000,
    "US gallon": 3.785411784,
    Cup: .2365882365
  },

  speed: {
    "m/s": 1,
    "km/h": 1 / 3.6,
    "mph": .44704,
    "ft/s": .3048
  },

  data: {
    Bit: 1,
    Byte: 8,
    Kilobit: 1000,
    Kilobyte: 8000,
    Megabit: 1000000,
    Megabyte: 8000000,
    Gigabit: 1000000000,
    Gigabyte: 8000000000,
    Terabyte: 8000000000000
  },

  temperature: {
    Celsius: 1,
    Fahrenheit: 1,
    Kelvin: 1
  }
};

function populateUnits() {
  const category = $("unitCategory").value;
  const list = Object.keys(units[category]);

  $("unitFrom").innerHTML = "";
  $("unitTo").innerHTML = "";

  list.forEach(unit => {
    $("unitFrom").add(new Option(unit, unit));
    $("unitTo").add(new Option(unit, unit));
  });

  if (list.length > 1) $("unitTo").selectedIndex = 1;
}

$("unitCategory").addEventListener("change", populateUnits);

populateUnits();

function convertTemperature(value, from, to) {
  let celsius;

  if (from === "Celsius") celsius = value;
  if (from === "Fahrenheit") celsius = (value - 32) * 5 / 9;
  if (from === "Kelvin") celsius = value - 273.15;

  if (to === "Celsius") return celsius;
  if (to === "Fahrenheit") return celsius * 9 / 5 + 32;
  if (to === "Kelvin") return celsius + 273.15;
}

$("convertUnits").addEventListener("click", () => {
  const category = $("unitCategory").value;
  const from = $("unitFrom").value;
  const to = $("unitTo").value;
  const value = getNumber("unitValue");

  if (!Number.isFinite(value)) {
    $("unitResult").textContent = "Enter a valid number.";
    return;
  }

  let result;

  if (category === "temperature") {
    result = convertTemperature(value, from, to);
  } else {
    result = value * units[category][from] / units[category][to];
  }

  $("unitResult").innerHTML =
    `${value} ${from} = <strong>${formatNumber(result)} ${to}</strong>`;
});


// =====================================================
// INITIALIZATION
// =====================================================

updateDisplay();
updateProgrammer();
updateComplement();
updateGray();
updateGate();

// SCIENTIFIC MODE TOGGLE

// SCIENTIFIC MODE TOGGLE

const scientificToggle = document.getElementById("scientificToggle");
const scientificToolbar = document.getElementById("scientificToolbar");
const scientificArrow = document.getElementById("scientificArrow");

if (scientificToggle && scientificToolbar) {
    scientificToggle.addEventListener("click", () => {
        const opening = scientificToolbar.classList.contains("hidden");

        scientificToolbar.classList.toggle("hidden");
        scientificToggle.classList.toggle("open", opening);

        if (scientificArrow) {
            scientificArrow.textContent = opening ? "⌃" : "⌄";
        }

        vibrate();
    });
}

/* ==========================
   SPIDER CALC MENU
========================== */

// =====================================================
// SPIDER CALC MENU
// =====================================================

const menuButton = document.getElementById("menuBtn");
const menuOverlayElement = document.getElementById("menuOverlay");
const menuCloseButton = document.getElementById("closeMenu");

function openToolsMenu() {
    if (!menuOverlayElement) return;

    menuOverlayElement.classList.remove("hidden");
    menuOverlayElement.classList.add("open");

    document.body.style.overflow = "hidden";
}

function closeToolsMenu() {
    if (!menuOverlayElement) return;

    menuOverlayElement.classList.remove("open");
    menuOverlayElement.classList.add("hidden");

    document.body.style.overflow = "";
}

if (menuButton) {
    menuButton.addEventListener("click", openToolsMenu);
}

if (menuCloseButton) {
    menuCloseButton.addEventListener("click", closeToolsMenu);
}

if (menuOverlayElement) {
    menuOverlayElement.addEventListener("click", (event) => {
        if (event.target === menuOverlayElement) {
            closeToolsMenu();
        }
    });
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeToolsMenu();
    }
});