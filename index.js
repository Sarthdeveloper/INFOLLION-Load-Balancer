// Import required modules
import express from "express";
import crypto from "crypto";

// Create express app
const app = express();

const PORT = process.env.PORT || 3000;

// Middleware to parse JSON requests
app.use(express.json());

// Rate limiting configuration
const rateLimit_Window = 60 * 1000; // 1 minute
const maxRequests_perWindow = 5;

// Store request counts for each IP
const rateLimitStore = new Map();

// Store request logs for metrics dashboard
const requestLogs = [];

// Generate random IP address
const generateRandomIP = () => {
  return Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 256)
  ).join(".");
};

// Hash ring configuration
const ringSize = 1000;
const virtualNodes = 10;

// Node class representing each server
class Node {
  constructor(id, capacity, weight) {
    this.id = id;
    this.capacity = capacity;
    this.currentLoad = 0;
    this.requestsHandled = 0;
    this.isHealthy = true;
    this.weight = weight;
  }

  // Check if node can accept request
  canHandleRequest() {
    return this.isHealthy && this.currentLoad < this.capacity;
  }

  // Increase load and handled requests
  handleRequest() {
    this.currentLoad++;
    this.requestsHandled++;
  }

  // Decrease current load
  finishRequest() {
    if (this.currentLoad > 0) this.currentLoad--;
  }
}

// List of backend server nodes
const nodes = [
  new Node("Node-A", 100, 6),
  new Node("Node-B", 200, 2),
  new Node("Node-C", 150, 1),
  new Node("Node-D", 120, 1),
];

// Consistent hash ring
let ring = [];

// Convert any value into hash ring position
function hashToPosition(value) {
  const hash = crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");

  const hashNumber = parseInt(hash.substring(0, 8), 16);

  return hashNumber % ringSize;
}

// Build consistent hashing ring
function buildRing() {
  ring = [];

  for (const node of nodes) {

    // Skip unhealthy nodes
    if (!node.isHealthy) continue;

    // Weighted routing using virtual nodes
    const totalVirtualNodes = virtualNodes * node.weight;

    for (let i = 0; i < totalVirtualNodes; i++) {
      ring.push({
        position: hashToPosition(`${node.id}-VN-${i}`),
        node: node.id,
      });
    }
  }

  // Sort ring positions in ascending order
  ring.sort((a, b) => a.position - b.position);
}

// Create ring initially
buildRing();

// Print ring for debugging
console.log(ring);

// Check whether IP exceeded request limit
function isRateLimited(ip) {
  const now = Date.now();

  // First request from IP
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, {
      count: 1,
      startTime: now,
    });

    return false;
  }

  const data = rateLimitStore.get(ip);

  // Reset window after time expires
  if (now - data.startTime > rateLimit_Window) {
    rateLimitStore.set(ip, {
      count: 1,
      startTime: now,
    });

    return false;
  }

  // Increase request count
  data.count++;

  // Return true if limit exceeded
  return data.count > maxRequests_perWindow;
}

// Log routed request
function identifyNode(ip, selectedNode) {
  console.log(`Incoming IP: ${ip} → Routed to: ${selectedNode}`);
}

// Main load balancer function
function loadBalancer(ip) {

  // Apply rate limiting
  if (isRateLimited(ip)) {
    console.log(`Rate limit exceeded for IP: ${ip}`);
    return "RATE_LIMITED";
  }

  // No healthy nodes available
  if (ring.length === 0) {
    console.log("No healthy nodes available");
    return null;
  }

  // Get IP position on hash ring
  const IPposition = hashToPosition(ip);

  // Find first clockwise node
  for (const pos of ring) {

    if (pos.position >= IPposition) {

      // Find actual node object
      const selectedNode = nodes.find(
        node => node.id === pos.node
      );

      // Check node health and capacity
      if (selectedNode && selectedNode.canHandleRequest()) {

        // Update node metrics
        selectedNode.handleRequest();

        // Print routing information
        identifyNode(ip, selectedNode.id);

        // Store request log
        requestLogs.push({
          ip,
          routedTo: selectedNode.id,
          time: new Date().toISOString(),
        });

        // Return selected node
        return selectedNode.id;
      }
    }
  }

  // Wrap around case:
  // If IP position is greater than all ring positions,
  // restart from beginning of ring

  for (const pos of ring) {

    const selectedNode = nodes.find(
      node => node.id === pos.node
    );

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

  // No available node found
  console.log("No node can handle request right now");

  return null;
}

// Simulate incoming traffic
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

// Root endpoint
app.get("/", (req, res) => {

  const ip = generateRandomIP();

  const selectedNode = loadBalancer(ip);

  res.json({
    ip: ip,
    routedTo: selectedNode,
  });
});

// Metrics dashboard endpoint
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

// Mark node unhealthy
app.post("/nodes/:id/down", (req, res) => {

  const node = nodes.find(
    node => node.id === req.params.id
  );

  if (!node) {
    return res
      .status(404)
      .json({ message: "Node not found" });
  }

  node.isHealthy = false;

  // Rebuild ring after node removal
  buildRing();

  res.json({
    message: `${node.id} marked unhealthy`,
    activeRingPoints: ring.length,
  });
});

// Mark node healthy
app.post("/nodes/:id/up", (req, res) => {

  const node = nodes.find(
    node => node.id === req.params.id
  );

  if (!node) {
    return res
      .status(404)
      .json({ message: "Node not found" });
  }

  node.isHealthy = true;

  // Rebuild ring after node recovery
  buildRing();

  res.json({
    message: `${node.id} marked healthy`,
    activeRingPoints: ring.length,
  });
});

// Route request endpoint
app.get("/route", (req, res) => {

  // Use query IP or generate random one
  const ip = req.query.ip || generateRandomIP();

  const selectedNode = loadBalancer(ip);

  // Handle rate limited response
  if (selectedNode === "RATE_LIMITED") {

    return res.status(429).json({
      ip,
      message: "Too many requests from this IP. Please try again later.",
    });
  }

  // Return routed node
  res.json({
    ip,
    routedTo: selectedNode,
  });
});

// Start server


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});