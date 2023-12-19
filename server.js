import express from "express";
import { createServer } from "http";
import path from "path";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);

const io = new Server(server);

app.use(express.static(path.join(process.cwd(), "public")));

let remoteItems = {};

io.of("/event").on("connection", (socket) => {
  const event_id = socket.handshake.query.event_id;
  socket.event_id = event_id;
  const guid = socket.event_id;
  if (!remoteItems[guid]) {
    remoteItems[guid] = { valueBlock: {}, clients: new Set() };
  }

  remoteItems[guid].clients.add(socket.id);

  //send active valueBlock to new client
  io.of("/event")
    .to(socket.id)
    .emit("remoteValue", remoteItems[guid].valueBlock);

  socket.on("disconnect", () => {
    for (let valueGuid in remoteItems) {
      if (
        remoteItems.hasOwnProperty(valueGuid) &&
        remoteItems[valueGuid]?.clients
      ) {
        if (remoteItems[valueGuid].clients.has(socket.id)) {
          remoteItems[valueGuid].clients.delete(socket.id);
          if (remoteItems[valueGuid].clients.size === 0) {
            delete remoteItems[valueGuid];
          }

          if (remoteItems[valueGuid]?.host === socket.id) {
            remoteItems[valueGuid].value = {};
            broadcastMessage(valueGuid, {});
          }
          break;
        }
      }
    }
  });

  socket.on("valueBlock", async (data) => {
    const { serverData, valueGuid } = data;
    remoteItems[valueGuid].valueBlock = serverData;
    broadcastMessage(valueGuid, serverData);
  });
});

function broadcastMessage(guid, message) {
  if (remoteItems?.[guid]?.clients) {
    remoteItems[guid].clients.forEach((client) => {
      io.of("/event").to(client).emit("remoteValue", message);
    });
  }
}

const port = process.env.PORT || 8000;

server.listen(port, () => {
  console.log("listening on *:" + port);
});
