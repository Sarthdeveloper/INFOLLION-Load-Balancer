# INFOLLION Load Balancer API

A beginner-friendly backend load balancer project built using Node.js and Express.  
This project replaces random request routing with Consistent Hashing using Virtual Nodes for stable and scalable request distribution.

---

# Features

- Consistent Hashing based routing
- Virtual Nodes for balanced traffic distribution
- Weighted Routing
- Basic Node Health Checks
- Rate Limiting Logic
- Request Logging
- Metrics Dashboard
- Express.js Backend APIs

---

# Tech Stack

- Node.js
- Express.js
- JavaScript
- Crypto (SHA-256 hashing)

---

# Project Structure

```txt
INFOLLION ASSIGNMENT/
│
├── index.js
├── package.json
├── package-lock.json
├── README.md
├── INFOLLION Load Balancer API.postman_collection.json
```

# Setup Instructions

## 1. Clone Repository

```bash
git clone https://github.com/Sarthdeveloper/INFOLLION-Load-Balancer.git
```

## 2. Navigate to Project Folder

```bash
cd INFOLLION-ASSIGNMENT
```

## 3. Install Dependencies

```bash
npm install
```

## 4. Run Server

```bash
npm start
```

Server will start at:

```txt
http://localhost:3000
```

---

# Load Balancing Logic

The project uses Consistent Hashing to distribute requests across backend nodes.

## Workflow

1. Generate or receive an IP address
2. Hash IP using SHA-256
3. Map hash onto a circular hash ring
4. Route request to nearest clockwise server node
5. Use virtual nodes and weighted routing for balanced traffic distribution

---

# API Endpoints

## Route Random IP

```http
GET /route
```

### Example

```txt
http://localhost:3000/route
```

---

## Route Fixed IP

```http
GET /route?ip=192.168.1.5
```

### Example

```txt
http://localhost:3000/route?ip=192.168.1.5
```

This demonstrates that the same IP generally routes to the same node while the ring remains unchanged.

---

## Metrics Dashboard

```http
GET /metrics
```

### Example

```txt
http://localhost:3000/metrics
```

### Returns

- total requests
- node health
- node load
- requests handled
- recent request logs

---

## Mark Node Unhealthy

```http
POST /nodes/:id/down
```

### Example

```txt
POST http://localhost:3000/nodes/Node-A/down
```

Removes node from active hash ring.

---

## Mark Node Healthy

```http
POST /nodes/:id/up
```

### Example

```txt
POST http://localhost:3000/nodes/Node-A/up
```

Adds node back into active hash ring.

---

# Rate Limiting

Each IP is limited to a fixed number of requests within a time window.

## Current Configuration

- Maximum Requests: 5
- Time Window: 1 minute

If limit exceeds:

```txt
429 Too Many Requests
```

response is returned.

---

# Weighted Routing

Nodes with higher weight receive more virtual nodes on the ring, increasing the probability of receiving traffic.

## Example

```txt
Node-A → weight 6
Node-B → weight 2
Node-C → weight 1
Node-D → weight 1
```

---

# Health Checks

Nodes can be dynamically marked healthy or unhealthy using API endpoints.

Unhealthy nodes are automatically removed from the consistent hashing ring.

---

# Postman Collection

The repository includes:

```txt
INFOLLION Load Balancer API.postman_collection.json
```

which contains all API endpoints for testing and demonstration.

---

# Sample Demo Flow

1. Route fixed IP
2. View metrics dashboard
3. Mark a node unhealthy
4. Route same IP again
5. Observe request remapping
6. Mark node healthy again

---

# Author

Sarth Pohare