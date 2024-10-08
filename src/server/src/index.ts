import "dotenv/config";
import { connections } from "./logReader";
import http from "http";
import { showLove } from "../../common/madeWithLove";

/**
 * Simple server to init the FE with the connections
 */
http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.writeHead(204); // No content
      res.end();
      return;
    }

    // Regular request handling
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    const json = JSON.stringify(
      Array.from(connections.entries()).reduce(
        (acc, [clientId, subscriptions]) => ({
          ...acc,
          [clientId]: subscriptions,
        }),
        {},
      ),
    );

    res.end(json);
  })
  .listen(process.env.PORT);

showLove();
