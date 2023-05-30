import { Object3D } from "three";

type EventLog = {
  type: string;
  object: Object3D;
  inputDeviceElementId?: number;
};

describe("translate events", () => {
  it("should fire enter and leave events");

  it("should fire enter, press, release, and then leave events");

  it("should capture all events to two objects");

  it("should fire enter twice and leave twice for two different translators");

  it(
    "should fire press twice for two input device element and then release for both"
  );

  it(
    "should fire press twice for one of two input device element and then release for the one"
  );

  it("should fire move for the upper group once");

  it(
    "should fire enter Group, enter child1, leave child1, enter child2, leave child2, leave group in that order"
  );

  it("should allow stop propagation of the first enter even on the child and then fire a leave event for both the child and the parent", () => {
    const actualEvents: Array<EventLog> = [];
    const child = new Object3D();
    child.addEventListener("enter", (event) => {
      actualEvents.push({ type: "enter", object: child });
      event.stopPropagation();
    });
    child.addEventListener("leave", () =>
      actualEvents.push({ type: "leave", object: child })
    );
    const parent = new Object3D();
    parent.addEventListener("enter", () =>
      actualEvents.push({ type: "enter", object: parent })
    );
    parent.addEventListener("leave", () =>
      actualEvents.push({ type: "leave", object: parent })
    );
    parent.add(child);

    expect(actualEvents).to.deep.equal([
      { type: "enter", object: child },
      { type: "leave", object: child },
      { type: "leave", object: parent },
    ] satisfies Array<EventLog>);
  });
});
