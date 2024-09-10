export type MqttEdge = d3.SimulationLinkDatum<d3.SimulationNodeDatum> & {
  id: string;
  topic?: string;
};

export type MqttNode = d3.SimulationNodeDatum & {
  id: string;
  isClient?: boolean;
  name?: string;
};
