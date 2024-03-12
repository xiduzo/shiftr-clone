export type Link = d3.SimulationLinkDatum<d3.SimulationNodeDatum> & {
  id: string;
  topic?: string;
};
export type Node = d3.SimulationNodeDatum & {
  id: string;
  isClient?: boolean;
  name?: string;
};

export const MQTT_BROKER_NODE_ID = "MQTT_BROKER_CENTER_NODE_ID";
export const CLIENT_ID_PREFIX = "SHIFTR_CLONE_CLIENT";
