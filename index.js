import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());

const rateLimit_Window = 60 * 1000; // 1 minute
const maxRequests_perWindow = 5;
const rateLimitStore = new Map();
const requestLogs = [];

//Generating random IP address
const generateRandomIP = () => {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join(
    ".",
  );
};

const ringSize = 1000;
const virtualNodes = 10;

class Node {
  constructor(id, capacity, weight) {
    this.id = id;
    this.capacity = capacity;
    this.currentLoad = 0;
    this.requestsHandled = 0;
    this.isHealthy = true;
    this.weight = weight;
  }

  canHandleRequest() {
    return this.isHealthy && this.currentLoad < this.capacity;
  }

  handleRequest() {
    this.currentLoad++;
    this.requestsHandled++;
  }

  finishRequest() {
    if (this.currentLoad > 0) this.currentLoad--;
  }
}
const nodes = [
  new Node("Node-A", 100, 6),
  new Node("Node-B", 200, 2),
  new Node("Node-C", 150, 1),
  new Node("Node-D", 120, 1),
];

let ring = [];

function hashToPosition(value) {
  const hash = crypto.createHash("sha256").update(value).digest("hex");

  const hashNumber = parseInt(hash.substring(0, 8), 16);

  return hashNumber % ringSize;
}
function buildRing() {
  ring = [];

  for (const node of nodes) {
    if (!node.isHealthy) continue;

    const totalVirtualNodes = virtualNodes * node.weight;

    for (let i = 0; i < totalVirtualNodes; i++) {
      ring.push({
        position: hashToPosition(`${node.id}-VN-${i}`),
        node: node.id,
      });
    }
  }

  ring.sort((a, b) => a.position - b.position);
}

buildRing();
console.log(ring);

function isRateLimited(ip) {
  const now = Date.now();

  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, {
      count: 1,
      startTime: now,
    });
    return false;
  }

  const data = rateLimitStore.get(ip);

  if (now - data.startTime > rateLimit_Window) {
    rateLimitStore.set(ip, {
      count: 1,
      startTime: now,
    });
    return false;
  }

  data.count++;

  return data.count > maxRequests_perWindow;
}
function identifyNode(ip, selectedNode) {
  console.log(`Incoming IP: ${ip} → Routed to: ${selectedNode}`);
}

function loadBalancer(ip) {
  if (isRateLimited(ip)) {
    console.log(`Rate limit exceeded for IP: ${ip}`);
    return "RATE_LIMITED";
  }

  if (ring.length === 0) {
    console.log("No healthy nodes available");
    return null;
  }

  const IPposition = hashToPosition(ip);

  for (const pos of ring) {
    if (pos.position >= IPposition) {
      const selectedNode = nodes.find(node => node.id === pos.node);

      if (selectedNode && selectedNode.canHandleRequest()) {
        selectedNode.handleRequest();
        identifyNode(ip, selectedNode.id);

        requestLogs.push({
          ip,
          routedTo: selectedNode.id,
          time: new Date().toISOString(),
        });

        return selectedNode.id;
      }
    }
  }

  // wrap around case
  for (const pos of ring) {
    const selectedNode = nodes.find(node => node.id === pos.node);

    if (selectedNode && selectedNode.canHandleRequest()) {
      selectedNode.handleRequest();
      identifyNode(ip, selectedNode.id);

      requestLogs.push({
        ip,
        routedTo: selectedNode.id,
        time: new Date().toISOString(),
      });

      return selectedNode.id;
    }
  }

  console.log("No node can handle request right now");
  return null;
}

function simulateTraffic(requestCount) {
  for (let i = 0; i < requestCount; i++) {
    const ip = generateRandomIP();
    console.log(ip);
    loadBalancer(ip);
    console.log("\n");
  }
}
// Run simulation for 10 requests
simulateTraffic(10);

app.get("/", (req, res) => {
  const ip = generateRandomIP();
  const selectedNode = loadBalancer(ip);

  res.json({
    ip: ip,
    routedTo: selectedNode,
  });
});

app.get("/metrics", (req, res) => {
  res.json({
    totalRequests: requestLogs.length,
    ringPoints: ring.length,
    nodes: nodes.map(node => ({
      id: node.id,
      capacity: node.capacity,
      currentLoad: node.currentLoad,
      requestsHandled: node.requestsHandled,
      isHealthy: node.isHealthy,
      weight: node.weight,
    })),
    recentLogs: requestLogs.slice(-10),
  });
});

app.post("/nodes/:id/down", (req, res) => {
  const node = nodes.find(node => node.id === req.params.id);

  if (!node) {
    return res.status(404).json({ message: "Node not found" });
  }

  node.isHealthy = false;
  buildRing();

  res.json({
    message: `${node.id} marked unhealthy`,
    activeRingPoints: ring.length,
  });
});

app.post("/nodes/:id/up", (req, res) => {
  const node = nodes.find(node => node.id === req.params.id);

  if (!node) {
    return res.status(404).json({ message: "Node not found" });
  }

  node.isHealthy = true;
  buildRing();

  res.json({
    message: `${node.id} marked healthy`,
    activeRingPoints: ring.length,
  });
});

app.get("/route", (req, res) => {
  const ip = req.query.ip || generateRandomIP();
  const selectedNode = loadBalancer(ip);

  if (selectedNode === "RATE_LIMITED") {
    return res.status(429).json({
      ip,
      message: "Too many requests from this IP. Please try again later.",
    });
  }

  res.json({
    ip,
    routedTo: selectedNode,
  });
});
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
