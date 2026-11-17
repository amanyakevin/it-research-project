const form = document.querySelector("#diagnosis-form");
const cropInput = document.querySelector("#crop");
const observationInput = document.querySelector("#observation");
const photoInput = document.querySelector("#photo");
const uploadArea = document.querySelector("#upload-area");
const uploadEmpty = document.querySelector("#upload-empty");
const previewWrap = document.querySelector("#preview-wrap");
const previewImage = document.querySelector("#preview-image");
const previewCaption = document.querySelector("#preview-caption");
const submitButton = document.querySelector("#submit-button");
const submitLabel = document.querySelector("#submit-label");
const formError = document.querySelector("#form-error");
const resultSection = document.querySelector("#result-section");
const aiStatus = document.querySelector("#ai-status");
const installButton = document.querySelector("#install-button");
const installHelp = document.querySelector("#install-help");
const maxFileSize = 10 * 1024 * 1024;
const modelUrl = new URL("assets/fieldnote-research-model.onnx", document.baseURI).href;
const modelClasses = [
  "healthy",
  "maize_rust",
  "maize_blight",
  "cassava_mosaic",
  "bean_spot"
];
const displayLabels = {
  healthy: "Healthy-looking leaf (model class)",
  maize_rust: "Maize common rust",
  maize_blight: "Northern maize leaf blight",
  cassava_mosaic: "Cassava mosaic disease",
  bean_spot: "Bean leaf spot"
};
const classGuidance = {
  cassava_mosaic: {
    local: [
      "Check several plants for mottled leaves or distortion and mark affected plants; similar symptoms can have other causes.",
      "Do not use cuttings from visibly affected plants. Ask a local extension officer about clean planting material."
    ],
    modern: [
      "Ask a district extension officer to confirm cassava mosaic and advise whether affected plants need removal.",
      "For future planting, ask about locally recommended tolerant varieties and clean, disease-free cuttings."
    ]
  },
  maize_rust: {
    local: [
      "Check both sides of several leaves for orange-brown raised spots and note how widely symptoms are spread.",
      "Keep scouting and record whether symptoms are appearing on newer leaves; do not spray based on a photo."
    ],
    modern: [
      "Ask an extension worker to confirm rust and whether the spread needs further action.",
      "For future planting, ask about rust-tolerant varieties suited to your district. Use crop-protection products only when locally recommended and label-approved."
    ]
  },
  maize_blight: {
    local: [
      "Check several leaves for long, cigar-shaped gray-green or tan lesions and note whether they are spreading.",
      "Keep a record of affected plants and avoid treating the crop based on this photo result alone."
    ],
    modern: [
      "Ask an extension officer to distinguish northern leaf blight from other leaf-spot conditions.",
      "For future planting, ask about resistant varieties and locally suitable crop rotation or residue management."
    ]
  },
  healthy: {
    local: [
      "Continue checking the crop and compare several leaves; a healthy-looking model result cannot rule out a problem.",
      "If symptoms continue or worsen, photograph the affected and healthy plants and ask a local extension officer to inspect them."
    ],
    modern: [
      "Seek an in-person assessment if symptoms persist or spread; the model can miss conditions it was not trained to identify.",
      "Do not apply a product unless a qualified local adviser recommends it for the confirmed problem."
    ]
  }
};
const symptomGuidance = {
  unsure: {
    local: [
      "Compare several affected leaves with healthy leaves and note when the change began and whether it is spreading.",
      "Check the plant and nearby plants for insects, leaf damage, soil dryness, or waterlogging; do not apply a treatment until the cause is checked."
    ],
    modern: [
      "Show the photos and notes to a district agricultural or extension officer for an in-person assessment.",
      "If many plants are affected or the problem is spreading quickly, contact an extension officer promptly."
    ]
  },
  mosaic: {
    local: [
      "Compare new and older leaves on several plants and note whether the mottling or distortion is spreading.",
      "Do not take planting cuttings from visibly affected plants while the cause is uncertain."
    ],
    modern: [
      "Ask an extension officer to check for cassava mosaic and other causes of mottling; this symptom alone cannot identify a disease.",
      "If cassava is affected, ask about clean planting material and locally recommended varieties."
    ]
  },
  curling: {
    local: [
      "Check new growth and the undersides of several curled leaves for insects, and note whether nearby plants are also affected.",
      "Photograph both sides of affected leaves and compare them with healthy plants before taking action."
    ],
    modern: [
      "Ask an extension officer to inspect for insect damage, disease, or other causes of leaf distortion.",
      "Do not spray based on curled leaves alone; use a product only if a local adviser confirms it is appropriate."
    ]
  },
  yellowing: {
    local: [
      "Note whether older or newer leaves yellow first, and check whether the soil is unusually dry or waterlogged.",
      "Compare several plants and check for root or stem damage; avoid adding fertilizer until the cause is better understood."
    ],
    modern: [
      "Ask an extension officer to distinguish water stress, nutrient problems, pests, and disease.",
      "If the problem continues, request an in-person crop and soil assessment before applying fertilizer or other products."
    ]
  },
  spots: {
    local: [
      "Check both sides of several leaves and note the spot shape, color, and whether lesions are increasing or joining together.",
      "Photograph affected and healthy leaves and record whether the problem is limited to one plant or spreading."
    ],
    modern: [
      "Ask an extension officer to compare the spots with common local diseases and other causes of leaf damage.",
      "Avoid spraying until the cause is confirmed and any treatment is recommended for that crop and location."
    ]
  },
  wilting: {
    local: [
      "Check soil moisture around affected plants and look for standing water, stem damage, or root disturbance.",
      "Compare wilting plants with healthy ones nearby and note whether wilting improves during cooler parts of the day."
    ],
    modern: [
      "Request an in-person assessment, especially if several plants wilt despite adequate soil moisture.",
      "Ask an extension officer to check for water stress, root problems, and disease before changing irrigation or applying products."
    ]
  },
  holes: {
    local: [
      "Inspect the leaves, stems, and leaf undersides for insects or fresh feeding damage; take a clear close-up photo.",
      "Check a few plants and note whether damage is new or spreading; avoid harming beneficial insects."
    ],
    modern: [
      "Ask an extension officer to identify the insect and assess whether the damage needs control.",
      "Do not use pesticides until the pest is identified and a locally approved option is recommended."
    ]
  }
};
const observationLabels = {
  unsure: "no specific symptom selected",
  mosaic: "mottled or mosaic-like leaf color",
  curling: "curled or misshapen leaves",
  yellowing: "yellowing leaves",
  spots: "spots or patches on leaves",
  wilting: "wilting or drooping",
  holes: "holes or visible insects"
};
const minModelScore = 0.65;
let previewUrl = "";
let installPrompt = null;
let modelSessionPromise = null;

if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true) {
  installButton.hidden = true;
}

function setError(message) {
  formError.textContent = message;
  formError.hidden = !message;
}

function hideResult() {
  resultSection.hidden = true;
}

function updateSubmitState() {
  submitButton.disabled = !cropInput.value || !photoInput.files?.length;
}

function clearPhoto() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = "";
  photoInput.value = "";
  previewImage.removeAttribute("src");
  previewWrap.hidden = true;
  uploadEmpty.hidden = false;
  hideResult();
  setError("");
  updateSubmitState();
}

function setPhoto(file) {
  setError("");
  if (!file) return;
  const supportedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!supportedTypes.includes(file.type)) {
    clearPhoto();
    setError("Choose a JPG, PNG, or WebP image.");
    return;
  }
  if (file.size > maxFileSize) {
    clearPhoto();
    setError("This photo is larger than 10 MB. Choose a smaller image.");
    return;
  }

  hideResult();
  const transfer = new DataTransfer();
  transfer.items.add(file);
  photoInput.files = transfer.files;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  previewImage.src = previewUrl;
  previewCaption.textContent = file.name;
  previewWrap.hidden = false;
  uploadEmpty.hidden = true;
  updateSubmitState();
}

function renderList(selector, items) {
  const list = document.querySelector(selector);
  list.replaceChildren();
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    list.append(li);
  }
}

function showResult(result) {
  document.querySelector("#result-title").textContent = result.diagnosis;
  const badge = document.querySelector("#result-badge");
  badge.textContent = `Raw model score ${Math.round(result.confidence)}% · research only`;
  document.querySelector("#result-summary").textContent = result.summary;
  renderList("#signs-list", result.signs);
  renderList("#local-list", result.actions?.local);
  renderList("#modern-list", result.actions?.modern);
  document.querySelector("#result-caution").textContent =
    result.caution || "This is an AI-assisted suggestion, not a confirmed diagnosis. Check with a local agricultural extension officer before treating your crop.";
  resultSection.hidden = false;
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateAiStatus(message = "On-device AI research prototype · photos stay on this phone") {
  aiStatus.replaceChildren();
  const dot = document.createElement("span");
  dot.className = "status-dot";
  aiStatus.append(dot, document.createTextNode(message));
}

function getModelSession() {
  if (!globalThis.ort) {
    throw new Error("The on-device model engine did not load. Reconnect and reload the app.");
  }
  if (!modelSessionPromise) {
    ort.env.wasm.wasmPaths = new URL("assets/", document.baseURI).href;
    ort.env.wasm.numThreads = 1;
    modelSessionPromise = ort.InferenceSession.create(modelUrl, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all"
    }).catch((error) => {
      modelSessionPromise = null;
      throw new Error(`The on-device crop model could not start: ${error.message}`);
    });
  }
  return modelSessionPromise;
}

function modelProbabilities(output) {
  const values = Array.from(output.data, Number);
  if (values.length !== modelClasses.length || values.some((value) => !Number.isFinite(value))) {
    throw new Error("The research model returned an unsupported result. No diagnosis was produced.");
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  if (values.every((value) => value >= 0 && value <= 1) && Math.abs(total - 1) < 0.02) {
    return values;
  }
  const max = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - max));
  const exponentialTotal = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / exponentialTotal);
}

async function classifyPhoto(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 224;
  canvas.height = 224;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("This browser could not prepare the image for on-device analysis.");
  }
  let pixels;
  try {
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  } finally {
    bitmap.close();
  }
  const input = new Float32Array(canvas.width * canvas.height * 3);
  for (let source = 0, target = 0; source < pixels.length; source += 4) {
    input[target++] = pixels[source] / 255;
    input[target++] = pixels[source + 1] / 255;
    input[target++] = pixels[source + 2] / 255;
  }

  const session = await getModelSession();
  const tensor = new ort.Tensor("float32", input, [1, canvas.height, canvas.width, 3]);
  const outputs = await session.run({ [session.inputNames[0]]: tensor });
  return modelProbabilities(outputs[session.outputNames[0]]);
}

function buildLocalResult(crop, scores) {
  const observation = observationInput.value;
  const topIndex = scores.indexOf(Math.max(...scores));
  const className = modelClasses[topIndex];
  const score = scores[topIndex];
  const scorePercent = Math.round(score * 100);
  const isHealthy = className === "healthy";
  const supportedForCrop = isHealthy ||
    (crop === "cassava" && className === "cassava_mosaic") ||
    (crop === "maize" && ["maize_rust", "maize_blight"].includes(className));
  const uncertain = score < minModelScore || !supportedForCrop;
  const label = displayLabels[className];
  let diagnosis = !supportedForCrop
    ? "Photo inconclusive — start with these checks"
    : uncertain
      ? "Photo inconclusive — start with these checks"
      : `Research model match: ${label}`;
  if (isHealthy && !uncertain) diagnosis = "The image model's closest class is healthy-looking";

  const cropName = crop === "cassava" ? "cassava" : "maize";
  let summary = `The on-device research model returned “${label}” as its closest class (raw model score ${scorePercent}%). This score is not a probability that the result is correct; the model has not been independently reproduced or validated on Ugandan farm photos.`;
  if (!supportedForCrop) {
    summary = `The model's closest class was “${label}” (raw model score ${scorePercent}%), which is not a supported result for ${cropName}. It cannot identify the cause from this photo. The practical next steps below are based on ${observationLabels[observation]} and are not a diagnosis.`;
  } else if (uncertain) {
    summary = `The on-device model did not meet its display threshold (raw model score ${scorePercent}%), so no cause is identified. The practical next steps below are based on ${observationLabels[observation]} and are not a diagnosis.`;
  } else if (isHealthy) {
    summary += " A healthy-looking prediction cannot rule out disease or other crop problems.";
  }

  const guidance = supportedForCrop && !uncertain
    ? classGuidance[className]
    : symptomGuidance[observation] || symptomGuidance.unsure;
  const localActions = [...guidance.local];
  const modernActions = [...guidance.modern];

  return {
    isDemo: false,
    diagnosis,
    confidence: scorePercent,
    summary,
    signs: [
      `${supportedForCrop ? "Closest model class" : "Model class not supported for this crop"}: ${label}. This is a research-model output, not a confirmed identification.`,
      `Your selected observation: ${observationLabels[observation]}. Different problems can cause similar symptoms.`
    ],
    actions: { local: localActions, modern: modernActions },
    caution: "Research prototype only: this model has not been validated on Ugandan farm photos. The suggested actions are general field-safety steps, not model-generated treatment advice. Do not spray, remove plants, or purchase treatment based on this result alone; consult a qualified local agricultural adviser."
  };
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  installHelp.hidden = false;
  if (!installPrompt) {
    installHelp.textContent = "On your phone, open the browser menu and choose “Add to Home screen” or “Install app”.";
    return;
  }

  installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  installPrompt = null;
  if (choice.outcome === "accepted") {
    installButton.hidden = true;
    installHelp.hidden = true;
  }
});

window.addEventListener("appinstalled", () => {
  installButton.hidden = true;
  installHelp.hidden = true;
  installPrompt = null;
});

cropInput.addEventListener("change", () => {
  hideResult();
  updateSubmitState();
});
observationInput.addEventListener("change", hideResult);
photoInput.addEventListener("change", () => setPhoto(photoInput.files?.[0]));
uploadArea.addEventListener("click", (event) => {
  if (event.target.closest("#remove-photo")) return;
  photoInput.click();
});
uploadArea.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    photoInput.click();
  }
});
document.querySelector("#remove-photo").addEventListener("click", (event) => {
  event.stopPropagation();
  clearPhoto();
});

for (const eventName of ["dragenter", "dragover"]) {
  uploadArea.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadArea.classList.add("is-dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  uploadArea.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadArea.classList.remove("is-dragging");
  });
}
uploadArea.addEventListener("drop", (event) => setPhoto(event.dataTransfer.files?.[0]));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError("");
  hideResult();
  if (!cropInput.value || !photoInput.files?.[0]) {
    setError("Select a crop and add a photo before continuing.");
    updateSubmitState();
    return;
  }

  submitButton.disabled = true;
  submitLabel.textContent = "Analyzing on this phone…";
  try {
    const file = photoInput.files[0];
    const scores = await classifyPhoto(file);
    showResult(buildLocalResult(cropInput.value, scores));
    updateAiStatus("On-device research model ready · photo analyzed on this phone");
  } catch (error) {
    setError(error.message || "AI diagnosis failed. Please try again.");
  } finally {
    submitButton.disabled = false;
    submitLabel.textContent = "Analyze photo & get recommendations";
    updateSubmitState();
  }
});

document.querySelector("#new-check").addEventListener("click", () => {
  hideResult();
  clearPhoto();
  cropInput.value = "";
  document.querySelector("#symptoms").value = "";
  document.querySelector("#region").value = "";
  updateSubmitState();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
});

updateSubmitState();
updateAiStatus();

if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("/service-worker.js").catch((error) => {
    console.error("Fieldnote offline app shell could not be registered.", error);
  });
}
