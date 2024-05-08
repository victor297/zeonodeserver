const express = require("express");
const app = express();
const http = require("http").Server(app);
const cors = require("cors");
const socketIO = require("socket.io")(http, {
  cors: {
    origin: "*",
  },
});
const path = require("path");

const PORT = 4000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

app.get("/api", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Maintain a map of all devices and currently connected devices for each email
const connectedDevices = {};
var currentDeviceId = {};

socketIO.on("connection", (socket) => {
  console.log(`${socket.id} user is just connected`);

  //pc and mobile joins with only email and device id which is the identifier so as to not get added to the pc connected devices whie pc joins with email and deviceId
  socket.on("activeUser", ({ email, deviceId }) => {
    console.log(email, deviceId);
    if (!connectedDevices[email]) {
      connectedDevices[email] = [deviceId];
    } else {
      if (!connectedDevices[email].includes(deviceId)) {
        connectedDevices[email].push(deviceId);
      }
    }
    socket.join(email);
    // socketIO
    //   .to(email)
    //   .emit("activePcs", [
    //     "aeb1749c5e8c48bcb8e99c3f68f6b4e0a307b95ee222b9e195a2fe8a0dc0e488",
    //     "c7baf06aa2024df01dbdaa2516c4147f23f44fd22b99d40ffaf8dd9dbf3b1d91",
    //   ]);
    socketIO.to(email).emit("activePcs", connectedDevices[email]);
  });

  // used to sync pc with mobile
  socket.on("userConnected", ({ deviceId }) => {
    socket.join(deviceId);
    console.log("called", deviceId);
    currentDeviceId[socket.id] = [deviceId];
    console.log("currentDeviceId", currentDeviceId);
    const users = socketIO.sockets.adapter.rooms.get(deviceId)?.size;
    console.log("number of user in the room", users);
    if (users === 2) {
      // send the id of pc if the two device are in syn to both devices
      socketIO.to(deviceId).emit("_connected", deviceId);
    } else {
      socketIO.to(deviceId).emit("_connected", null);
    }
  });
  // when subscribed recipe
  socket.on("audioData", ({ audioChunk, deviceId }) => {
    socketIO.to(deviceId).emit("audioChunk", audioChunk);
  });

  socket.on("disconnect", () => {
    var id = 0;
    if (currentDeviceId[socket.id]) {
      id = currentDeviceId[socket.id][0];
    }
    console.log("User id:", id);
    Object.keys(connectedDevices).forEach((email) => {
      connectedDevices[email] = connectedDevices[email].filter(
        (deviceId) => deviceId !== id
      );
      socketIO.to(email).emit("activePcs", connectedDevices[email]);
      console.log("user remaining", connectedDevices[email]);
      console.log("user disconnected");
    });
  });
});

// Check if both devices are in sync
app.get("/api/syncStatus", (req, res) => {
  const email = req.query.email;
  const desktop = req.query.desktop;
  const mobile = req.query.mobile;
  const synced =
    connectedDevices[email] &&
    connectedDevices[email].includes(desktop) &&
    connectedDevices[email].includes(mobile);
  res.json({ synced });
});

http.listen(PORT, () => {
  console.log(`Server is listening on ${PORT}`);
});
