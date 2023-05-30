import { Intersection } from "@react-three/fiber";

export function makeId(event: Intersection) {
  return (
    (event.eventObject || event.object).uuid +
    "/" +
    event.index +
    event.instanceId
  );
}
