import {
    CLIENT_ID_PREFIX,
    MQTT_BROKER_NODE_ID,
} from "../../../common/constants";
import { Store } from "../d3/store";
import { updateSvg } from "../d3/svg";
import { MqttEdge } from "../d3/types";
import {
    createClientNodeIfNotExist,
    createPathNodesIfNotExist,
    findOrCreateNode,
} from "../d3/utils";

export function fetchConnections() {
  fetch(import.meta.env.VITE_CLIENT_HTTP_CONNECTIONS)
    .then((res) => res.json())
    .then(async (data: Record<string, string[]>) => {
      console.log(data);
      const clients = Object.entries(data);
      const clientIds = [
        MQTT_BROKER_NODE_ID,
        ...clients.map(([clientId]) => clientId),
      ];

      const edges: MqttEdge[] = [];
      const nodes = Store.getNodes().filter(({ id }) => clientIds.includes(id));
      Store.updateStore(nodes, edges);


      clients.forEach(([clientId, topics]) => {
        if (clientId.includes(CLIENT_ID_PREFIX)) return;
        createClientNodeIfNotExist(clientId);
        Store.addEdge({
          id: `${MQTT_BROKER_NODE_ID}_${clientId}`,
          source: findOrCreateNode(MQTT_BROKER_NODE_ID),
          target: findOrCreateNode(clientId),
        });
        topics.forEach((topic) => createPathNodesIfNotExist(topic, clientId));
      });

      updateSvg();
    })
    .catch((err) => console.error(err));
}
