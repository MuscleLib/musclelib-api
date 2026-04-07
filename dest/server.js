const path = require("path");
const express = require("express");
const dns = require("dns");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const exerciseRoutes = require("../api/exerciseRoutes");
const Exercise = require("../api/Exercise");

const DOCS_BASE = process.env.DOCS
const dbURI = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_NAME;
const dnsServersRaw = process.env.DNS_SERVERS;
const PORT = process.env.PORT;
const app = express();

mongoose.set("strictQuery", false);

const dnsServers = typeof dnsServersRaw === "string" ? dnsServersRaw.trim() : "";
const hasCustomDns =
  dnsServers.length > 0 &&
  dnsServers.toLowerCase() !== "undefined" &&
  dnsServers.toLowerCase() !== "null";

if (hasCustomDns) {
  const servers = dnsServers
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);
  if (servers.length) {
    dns.setServers(servers);
  }
}

// Conexão com MongoDB
mongoose.connect(dbURI, {
  dbName,
  socketTimeoutMS: 30000,
  serverSelectionTimeoutMS: 30000
})
.then(() => console.log("MongoDB conectado com sucesso!"))
.catch(err => {
  console.error("Erro ao conectar ao MongoDB:", err);
  process.exit(1);
});

/*
// Função para enviar logs ao MuscleLibLogs
const sendLog = async (logData) => {
  try {
    await axios.post(process.env.MUSCLELIB_LOGS_URL, logData, {
      headers: { "x-api-key": process.env.MUSCLELIB_LOGS_API_KEY },
    });
  } catch (error) {
    console.error("❌ Erro ao enviar log:", error.response?.data || error.message);
  }
};
// Armazena o tempo de início de sessão por IP
const sessionTimes = {};

// Middleware para capturar requisições e registrar logs
app.use((req, res, next) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress; // Captura o IP real
  const userAgent = req.get("User-Agent");
  const firstAccess = sessionTimes[ip] || Date.now();
  sessionTimes[ip] = Date.now();
  const sessionDuration = (Date.now() - firstAccess) / 1000; // Tempo de permanência em segundos

  res.on("finish", async () => {
    const logData = {
      service: "MuscleLib API",
      endpoint: req.originalUrl,
      method: req.method,
      status: res.statusCode,
      ip,
      userAgent,
      sessionDuration,
    };

    await sendLog(logData);
  });

  next();
});
*/

app.use(cors());
app.use(express.json());
app.use("/exercises", express.static(path.resolve(__dirname, "../exercises")));
app.use("/api/exercises", exerciseRoutes);

// Endpoint para contar exercícios e imagens
app.get("/stats", async (req, res) => {
  try {
    const totalExercises = await Exercise.countDocuments({});
    const totalImages = totalExercises * 2;
    res.json({ totalExercises, totalImages });
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    res.status(500).json({ message: "Erro ao buscar estatísticas", error: error.message });
  }
});

// Endpoint para verificar se a API está ativa
app.get("/api/ping", (req, res) => {
  res.status(200).send("pong");
});

// Rota principal 
app.get("/", (req, res) => res.redirect(302, `${DOCS_BASE}/`));

// Rota para a documentação
app.get("/docs", (req, res) => res.redirect(302, `${DOCS_BASE}/`));


/*
// Manipulador global de erros (agora enviando logs)
app.use((err, req, res, next) => {
  console.error(err.stack);

  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const userAgent = req.get("User-Agent");

  const logData = {
    service: "MuscleLib API",
    endpoint: req.originalUrl,
    method: req.method,
    status: 500,
    ip,
    userAgent,
    error: err.message,
  };

  sendLog(logData);

  res.status(500).json({ message: "Erro interno no servidor", error: err.message });
});
*/

// Inicialização do servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
