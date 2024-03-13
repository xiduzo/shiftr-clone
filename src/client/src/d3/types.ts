export type SimulationLink = d3.SimulationLinkDatum<d3.SimulationNodeDatum> & {
  id: string;
  topic?: string;
};
export type SimulationNode = d3.SimulationNodeDatum & {
  id: string;
  isClient?: boolean;
  name?: string;
};
