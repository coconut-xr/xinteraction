import { expect } from "chai";
import { Group, Object3D, Quaternion, Vector3 } from "three";
import { MockInputDevice } from "./mocks.js";
import { XIntersection } from "../../src/index.js";

type EventLog = {
  type: string;
  objectUUID: string;
  inputDeviceElementId?: number;
  inputDeviceId?: number;
};

describe("translate events", () => {
  it("should fire enter and leave events", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const object = new Object3D();
    object.addEventListener("enter", (event) => {
      actualEvents.push({ type: "enter", objectUUID: object.uuid });
      event.stopPropagation();
    });
    object.addEventListener("leave", () =>
      actualEvents.push({ type: "leave", objectUUID: object.uuid })
    );

    inputDevice.update([
      {
        object: object,
        distance: 0,
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
        intersections: []
      },
    ]);
    inputDevice.update([]);

    expect(actualEvents).to.deep.equal([
      { type: "enter", objectUUID: object.uuid },
      { type: "leave", objectUUID: object.uuid },
    ] satisfies Array<EventLog>);
  });

  it("should fire enter, press, release, and then leave events", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const object = new Object3D();
    object.addEventListener("enter", (event) => {
      actualEvents.push({ type: "enter", objectUUID: object.uuid });
    });
    object.addEventListener("press", ({ inputDeviceElementId }) => {
      actualEvents.push({
        type: "press",
        objectUUID: object.uuid,
        inputDeviceElementId,
      });
    });
    object.addEventListener("release", ({ inputDeviceElementId }) => {
      actualEvents.push({
        type: "release",
        objectUUID: object.uuid,
        inputDeviceElementId,
      });
    });
    object.addEventListener("leave", () =>
      actualEvents.push({ type: "leave", objectUUID: object.uuid })
    );

    inputDevice.update([
      {
        object: object,
        distance: 0,
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
        intersections: []
      },
    ]);
    inputDevice.update(undefined, new Map([[object, [101]]]), 101);
    inputDevice.update(undefined, new Map());
    inputDevice.update([]);

    expect(actualEvents).to.deep.equal([
      { type: "enter", objectUUID: object.uuid },
      { type: "press", objectUUID: object.uuid, inputDeviceElementId: 101 },
      { type: "release", objectUUID: object.uuid, inputDeviceElementId: 101 },
      { type: "leave", objectUUID: object.uuid },
    ] satisfies Array<EventLog>);
  });

  it("should fire release even dough dragged in", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const object = new Object3D();
    object.addEventListener("release", ({ inputDeviceElementId }) => {
      actualEvents.push({
        type: "release",
        objectUUID: object.uuid,
        inputDeviceElementId,
      });
    });

    inputDevice.update([], [101]);
    inputDevice.update(
      [
        {
          object: object,
          distance: 0,
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
          intersections: []
        },
      ],
      undefined
    );
    inputDevice.update(undefined, []);

    expect(actualEvents).to.deep.equal([
      { type: "release", objectUUID: object.uuid, inputDeviceElementId: 101 },
    ] satisfies Array<EventLog>);
  });

  it("should capture all events to one object", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const object1 = new Object3D();
    const object2 = new Object3D();
    let pressEvent: any;
    object1.addEventListener("enter", () =>
      actualEvents.push({ type: "enter", objectUUID: object1.uuid })
    );
    object1.addEventListener("press", (event) => {
      actualEvents.push({ type: "press", objectUUID: object1.uuid });
      event.mockTarget.setPointerCapture();
      pressEvent = event;
    });
    object1.addEventListener("leave", () =>
      actualEvents.push({ type: "leave", objectUUID: object1.uuid })
    );
    object1.addEventListener("move", () =>
      actualEvents.push({ type: "move", objectUUID: object1.uuid })
    );
    object1.addEventListener("release", () =>
      actualEvents.push({ type: "release", objectUUID: object1.uuid })
    );
    object1.addEventListener("losteventcapture", (event) => {
      actualEvents.push({ type: "losteventcapture", objectUUID: object1.uuid });
    });

    object2.addEventListener("enter", (event) => {
      actualEvents.push({ type: "enter", objectUUID: object2.uuid });
    });
    object2.addEventListener("press", (event) => {
      actualEvents.push({ type: "press", objectUUID: object2.uuid });
    });
    object2.addEventListener("release", () =>
      actualEvents.push({ type: "release", objectUUID: object2.uuid })
    );
    object2.addEventListener("leave", (event) => {
      actualEvents.push({ type: "leave", objectUUID: object2.uuid });
    });

    //press on object 1
    inputDevice.update(
      [
        {
          object: object1,
          distance: 0,
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
          intersections: []
        },
      ],
      [1],
      1
    );
    expect(pressEvent.mockTarget.hasPointerCapture()).to.equal(true);
    //leave object 1 and enter object 2
    inputDevice.update(
      [
        {
          object: object2,
          distance: 0,
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
          intersections: []
        },
      ],
      [1]
    );
    expect(pressEvent.mockTarget.hasPointerCapture()).to.equal(true);
    //release button
    inputDevice.update(undefined, []);
    expect(pressEvent.mockTarget.hasPointerCapture()).to.equal(false);

    expect(actualEvents).to.deep.equal([
      //click on object 1
      { type: "enter", objectUUID: object1.uuid },
      { type: "press", objectUUID: object1.uuid },
      //leave object 1 and enter object 2
      { type: "move", objectUUID: object1.uuid },
      //release button => remove event capture => enter object 2
      { type: "release", objectUUID: object1.uuid },
      { type: "losteventcapture", objectUUID: object1.uuid },
    ] satisfies Array<EventLog>);
  });

  it("should remove event catpure", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const object = new Object3D();
    let pressEvent: any;
    object.addEventListener("press", (event) => {
      actualEvents.push({ type: "press", objectUUID: object.uuid });
      event.mockTarget.setPointerCapture();
      pressEvent = event;
    });
    object.addEventListener("leave", (event) => {
      actualEvents.push({ type: "leave", objectUUID: object.uuid });
    });

    //click on object 1
    inputDevice.update(
      [
        {
          object: object,
          distance: 0,
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
          intersections: []
        },
      ],
      [1],
      1
    );
    expect(pressEvent.mockTarget.hasPointerCapture()).to.equal(true);
    pressEvent.mockTarget.releasePointerCapture();
    expect(pressEvent.mockTarget.hasPointerCapture()).to.equal(false);
    inputDevice.update([], undefined);
    expect(pressEvent.mockTarget.hasPointerCapture()).to.equal(false);

    expect(actualEvents).to.deep.equal([
      //click on object 1
      { type: "press", objectUUID: object.uuid },
      { type: "leave", objectUUID: object.uuid },
    ] satisfies Array<EventLog>);
  });

  it("should select (click)", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const object = new Object3D();
    object.addEventListener("select", (event) => {
      actualEvents.push({ type: "select", objectUUID: object.uuid });
    });

    //enter and press
    inputDevice.update(
      [
        {
          object: object,
          distance: 0,
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
          intersections: []
        },
      ],
      [1],
      1
    );
    //release
    inputDevice.update(undefined, []);

    expect(actualEvents).to.deep.equal([
      { type: "select", objectUUID: object.uuid },
    ] satisfies Array<EventLog>);
  });

  it("should select (click) on leave", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const object = new Object3D();
    object.addEventListener("select", (event) => {
      actualEvents.push({ type: "select", objectUUID: object.uuid });
    });

    //enter and press
    inputDevice.update(
      [
        {
          object: object,
          distance: 0,
          intersections: [],
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
        },
      ],
      [1],
      1
    );
    //release
    inputDevice.update([], []);

    expect(actualEvents).to.deep.equal([
      { type: "select", objectUUID: object.uuid },
    ] satisfies Array<EventLog>);
  });

  it("should not select (click)", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const object = new Object3D();
    object.addEventListener("select", (event) => {
      actualEvents.push({ type: "select", objectUUID: object.uuid });
    });

    //enter and press
    inputDevice.update(
      [
        {
          object: object,
          distance: 0,
          intersections: [],
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
        },
      ],
      [1],
      1
    );
    //leave
    inputDevice.update([], undefined);
    //enter and release
    inputDevice.update(
      [
        {
          object: object,
          distance: 0,
          intersections: [],
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
        },
      ],
      [1]
    );

    expect(actualEvents).to.deep.equal([] satisfies Array<EventLog>);
  });

  it("should fire enter twice and leave twice for two different translators", () => {
    const inputDevice1 = new MockInputDevice(10);
    const inputDevice2 = new MockInputDevice(11);
    const actualEvents: Array<EventLog> = [];
    const object = new Object3D();
    object.addEventListener("enter", ({ inputDeviceId }) => {
      actualEvents.push({
        type: "enter",
        objectUUID: object.uuid,
        inputDeviceId,
      });
    });
    object.addEventListener("leave", ({ inputDeviceId }) =>
      actualEvents.push({
        type: "leave",
        objectUUID: object.uuid,
        inputDeviceId,
      })
    );

    inputDevice1.update([
      {
        object: object,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ]);
    inputDevice2.update([
      {
        object: object,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ]);
    inputDevice1.update([]);
    inputDevice2.update([]);

    expect(actualEvents).to.deep.equal([
      { type: "enter", objectUUID: object.uuid, inputDeviceId: 10 },
      { type: "enter", objectUUID: object.uuid, inputDeviceId: 11 },
      { type: "leave", objectUUID: object.uuid, inputDeviceId: 10 },
      { type: "leave", objectUUID: object.uuid, inputDeviceId: 11 },
    ] satisfies Array<EventLog>);
  });

  it("should fire nothing", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const object = new Object3D();
    object.addEventListener("enter", (event) => {
      actualEvents.push({ type: "enter", objectUUID: object.uuid });
    });
    object.addEventListener("press", (event) => {
      actualEvents.push({ type: "press", objectUUID: object.uuid });
    });
    object.addEventListener("release", (event) => {
      actualEvents.push({ type: "release", objectUUID: object.uuid });
    });
    object.addEventListener("leave", () =>
      actualEvents.push({ type: "leave", objectUUID: object.uuid })
    );

    inputDevice.update([], new Map([[object, []]]));
    inputDevice.update([]);

    expect(actualEvents).to.deep.equal([] satisfies Array<EventLog>);
  });

  it("should fire press twice for two input device element and then release for both", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const object = new Object3D();

    object.addEventListener("press", ({ inputDeviceElementId }) => {
      actualEvents.push({
        type: "press",
        objectUUID: object.uuid,
        inputDeviceElementId,
      });
    });
    object.addEventListener("release", ({ inputDeviceElementId }) => {
      actualEvents.push({
        type: "release",
        objectUUID: object.uuid,
        inputDeviceElementId,
      });
    });

    inputDevice.update(
      [
        {
          object,
          distance: 0,
          intersections: [],
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
        },
      ],
      [1, 2],
      1,
      2
    );
    inputDevice.update(undefined, []);

    expect(actualEvents).to.deep.equal([
      { type: "press", objectUUID: object.uuid, inputDeviceElementId: 1 },
      { type: "press", objectUUID: object.uuid, inputDeviceElementId: 2 },
      { type: "release", objectUUID: object.uuid, inputDeviceElementId: 1 },
      { type: "release", objectUUID: object.uuid, inputDeviceElementId: 2 },
    ] satisfies Array<EventLog>);
  });

  it("should fire press for two objects and then release for both", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const object1 = new Object3D();
    const object2 = new Object3D();
    object1.addEventListener("press", (event) => {
      actualEvents.push({ type: "press", objectUUID: object1.uuid });
    });
    object1.addEventListener("release", () =>
      actualEvents.push({ type: "release", objectUUID: object1.uuid })
    );

    object2.addEventListener("press", (event) => {
      actualEvents.push({ type: "press", objectUUID: object2.uuid });
    });
    object2.addEventListener("release", () =>
      actualEvents.push({ type: "release", objectUUID: object2.uuid })
    );

    inputDevice.update(
      [
        {
          object: object1,
          distance: 0,
          intersections: [],
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
        },
        {
          object: object2,
          distance: 0,
          intersections: [],
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
        },
      ],
      [1],
      1
    );
    inputDevice.update(undefined, []);

    expect(actualEvents).to.deep.equal([
      { type: "press", objectUUID: object1.uuid },
      { type: "press", objectUUID: object2.uuid },
      { type: "release", objectUUID: object1.uuid },
      { type: "release", objectUUID: object2.uuid },
    ] satisfies Array<EventLog>);
  });

  it("should fire press for one of two objects and then release the one", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const object1 = new Object3D();
    const object2 = new Object3D();
    object1.addEventListener("press", (event) => {
      actualEvents.push({ type: "press", objectUUID: object1.uuid });
    });
    object1.addEventListener("release", () =>
      actualEvents.push({ type: "release", objectUUID: object1.uuid })
    );

    object2.addEventListener("press", (event) => {
      actualEvents.push({ type: "press", objectUUID: object2.uuid });
    });
    object2.addEventListener("release", () =>
      actualEvents.push({ type: "release", objectUUID: object2.uuid })
    );

    inputDevice.update(
      [
        {
          object: object1,
          distance: 0,
          intersections: [],
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
        },
        {
          object: object2,
          distance: 0,
          intersections: [],
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
        },
      ],
      new Map([[object1, [1]]]),
      1
    );
    inputDevice.update(undefined, []);

    expect(actualEvents).to.deep.equal([
      { type: "press", objectUUID: object1.uuid },
      { type: "release", objectUUID: object1.uuid },
    ] satisfies Array<EventLog>);
  });

  it("should fire press for two objects element and then release for one", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const object1 = new Object3D();
    const object2 = new Object3D();
    object1.addEventListener("press", (event) => {
      actualEvents.push({ type: "press", objectUUID: object1.uuid });
    });
    object1.addEventListener("release", () =>
      actualEvents.push({ type: "release", objectUUID: object1.uuid })
    );

    object2.addEventListener("press", (event) => {
      actualEvents.push({ type: "press", objectUUID: object2.uuid });
    });
    object2.addEventListener("release", () =>
      actualEvents.push({ type: "release", objectUUID: object2.uuid })
    );

    inputDevice.update(
      [
        {
          object: object1,
          distance: 0,
          intersections: [],
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
        },
        {
          object: object2,
          distance: 0,
          intersections: [],
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
        },
      ],
      [1],
      1
    );
    inputDevice.update(undefined, new Map([[object1, [1]]]));

    expect(actualEvents).to.deep.equal([
      { type: "press", objectUUID: object1.uuid },
      { type: "press", objectUUID: object2.uuid },
      { type: "release", objectUUID: object2.uuid },
    ] satisfies Array<EventLog>);
  });

  it("should fire move for the upper group once", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const group = new Group();
    const child1 = new Object3D();
    const child2 = new Object3D();
    group.add(child1, child2);
    group.addEventListener("enter", (event) => {
      actualEvents.push({ type: "enter", objectUUID: group.uuid });
    });
    group.addEventListener("move", (event) => {
      actualEvents.push({ type: "move", objectUUID: group.uuid });
    });
    group.addEventListener("leave", (event) => {
      actualEvents.push({ type: "leave", objectUUID: group.uuid });
    });

    //enter
    inputDevice.update([
      {
        object: child1,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
      {
        object: child1,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ]);
    //move
    inputDevice.update([
      {
        object: child2,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
      {
        object: child2,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ]);
    //move
    inputDevice.update([
      {
        object: child2,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ]);
    //leave
    inputDevice.update([]);

    expect(actualEvents).to.deep.equal([
      { type: "enter", objectUUID: group.uuid },
      { type: "move", objectUUID: group.uuid },
      { type: "move", objectUUID: group.uuid },
      { type: "leave", objectUUID: group.uuid },
    ] satisfies Array<EventLog>);
  });

  it("should fire enter Group, enter child1, leave child1, enter child2, leave child2, leave group in that order", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const group = new Group();
    const child1 = new Object3D();
    const child2 = new Object3D();
    group.add(child1, child2);
    group.addEventListener("enter", (event) => {
      actualEvents.push({ type: "enter", objectUUID: group.uuid });
    });
    group.addEventListener("leave", (event) => {
      actualEvents.push({ type: "leave", objectUUID: group.uuid });
    });
    child1.addEventListener("enter", (event) => {
      actualEvents.push({ type: "enter", objectUUID: child1.uuid });
    });
    child1.addEventListener("leave", (event) => {
      actualEvents.push({ type: "leave", objectUUID: child1.uuid });
    });
    child2.addEventListener("enter", (event) => {
      actualEvents.push({ type: "enter", objectUUID: child2.uuid });
    });
    child2.addEventListener("leave", (event) => {
      actualEvents.push({ type: "leave", objectUUID: child2.uuid });
    });

    //enter child1
    inputDevice.update([
      {
        object: child1,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ]);
    //leave child1 but enter child2
    inputDevice.update([
      {
        object: child2,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ]);
    //leave child2
    inputDevice.update([]);

    expect(actualEvents).to.deep.equal([
      //enter child1
      { type: "enter", objectUUID: child1.uuid },
      { type: "enter", objectUUID: group.uuid },

      //leave child1 and enter child2
      { type: "enter", objectUUID: child2.uuid },
      { type: "leave", objectUUID: child1.uuid },

      //leave child2˚
      { type: "leave", objectUUID: child2.uuid },
      { type: "leave", objectUUID: group.uuid },
    ] satisfies Array<EventLog>);
  });

  it("should allow stop propagation of the first enter even on the child and then fire a leave event for both the child and the parent", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const child = new Object3D();
    child.addEventListener("enter", (event) => {
      actualEvents.push({ type: "enter", objectUUID: child.uuid });
      event.stopPropagation();
    });
    child.addEventListener("leave", () =>
      actualEvents.push({ type: "leave", objectUUID: child.uuid })
    );
    const parent = new Object3D();
    parent.addEventListener("enter", () =>
      actualEvents.push({ type: "enter", objectUUID: parent.uuid })
    );
    parent.addEventListener("leave", () =>
      actualEvents.push({ type: "leave", objectUUID: parent.uuid })
    );
    parent.add(child);

    inputDevice.update([
      {
        object: child,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ]);
    inputDevice.update([]);

    expect(actualEvents).to.deep.equal([
      { type: "enter", objectUUID: child.uuid },
      { type: "leave", objectUUID: child.uuid },
      { type: "leave", objectUUID: parent.uuid },
    ] satisfies Array<EventLog>);
  });

  it("should call events only once on parent", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const child = new Object3D();
    const parent = new Object3D();
    parent.addEventListener("enter", () =>
      actualEvents.push({ type: "enter", objectUUID: parent.uuid })
    );
    parent.addEventListener("move", () =>
      actualEvents.push({ type: "move", objectUUID: parent.uuid })
    );
    parent.add(child);

    inputDevice.update([
      {
        object: child,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
      {
        object: parent,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ]);
    inputDevice.update([
      {
        object: child,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
      {
        object: parent,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ]);

    expect(actualEvents).to.deep.equal([
      { type: "enter", objectUUID: parent.uuid },
      { type: "move", objectUUID: parent.uuid },
    ] satisfies Array<EventLog>);
  });

  it("should stop propagation for enter while moving over both objects", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];

    const object1 = new Object3D();
    object1.addEventListener("enter", (event) => {
      actualEvents.push({ type: "enter", objectUUID: object1.uuid });
      event.stopPropagation();
    });

    const object2 = new Object3D();
    object2.addEventListener("enter", () =>
      actualEvents.push({ type: "enter", objectUUID: object2.uuid })
    );

    inputDevice.update([
      {
        object: object1,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ]);
    inputDevice.update([
      {
        object: object1,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
      {
        object: object2,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ]);

    expect(actualEvents).to.deep.equal([
      { type: "enter", objectUUID: object1.uuid },
    ] satisfies Array<EventLog>);
  });

  it("should move over 2 objects which stop propagation on enter and enter and leave the first then enter and leave the second", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];

    const object1 = new Object3D();
    object1.addEventListener("enter", (event) => {
      actualEvents.push({ type: "enter", objectUUID: object1.uuid });
      event.stopPropagation();
    });
    object1.addEventListener("leave", () =>
      actualEvents.push({ type: "leave", objectUUID: object1.uuid })
    );

    const object2 = new Object3D();
    object2.addEventListener("enter", (event) => {
      actualEvents.push({ type: "enter", objectUUID: object2.uuid });
      event.stopPropagation();
    });
    object2.addEventListener("leave", () =>
      actualEvents.push({ type: "leave", objectUUID: object2.uuid })
    );

    inputDevice.update([
      {
        object: object1,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ]);
    inputDevice.update([
      {
        object: object1,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
      {
        object: object2,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ]);
    inputDevice.update([
      {
        object: object2,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ]);
    inputDevice.update([]);

    expect(actualEvents).to.deep.equal([
      //enter object 1
      { type: "enter", objectUUID: object1.uuid },
      //enter both (nothing happens)
      //leave object 1
      { type: "enter", objectUUID: object2.uuid },
      { type: "leave", objectUUID: object1.uuid },
      //leave object 2
      { type: "leave", objectUUID: object2.uuid },
    ] satisfies Array<EventLog>);
  });

  it("should not trigger select because the pointer was dragged in", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const object = new Object3D();
    object.addEventListener("select", ({ inputDeviceElementId }) => {
      actualEvents.push({
        type: "select",
        objectUUID: object.uuid,
        inputDeviceElementId,
      });
    });

    inputDevice.update(
      [
        {
          object: object,
          distance: 0,
          intersections: [],
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
        },
      ],
      [1]
    );

    inputDevice.update(undefined, []);

    expect(actualEvents).to.deep.equal([] satisfies Array<EventLog>);
  });

  it("should trigger select because the pointer was not dragged in (the pointer was pressed inside)", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];
    const object = new Object3D();
    object.addEventListener("select", ({ inputDeviceElementId }) => {
      actualEvents.push({
        type: "select",
        objectUUID: object.uuid,
        inputDeviceElementId,
      });
    });

    inputDevice.update(
      [
        {
          object: object,
          distance: 0,
          intersections: [],
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
        },
      ],
      [1],
      1
    );

    inputDevice.update(undefined, []);

    expect(actualEvents).to.deep.equal([
      { type: "select", objectUUID: object.uuid, inputDeviceElementId: 1 },
    ] satisfies Array<EventLog>);
  });

  it("should fire the event on the 'eventObject' not the intersected 'object'", () => {
    const inputDevice = new MockInputDevice(1);
    const actualEvents: Array<EventLog> = [];

    const child = new Object3D();
    child.addEventListener("press", ({ inputDeviceElementId, eventObject }) => {
      actualEvents.push({
        type: "press",
        objectUUID: eventObject.uuid,
        inputDeviceElementId,
      });
    });

    const parent = new Object3D();
    parent.addEventListener(
      "press",
      ({ inputDeviceElementId, eventObject }) => {
        actualEvents.push({
          type: "press",
          objectUUID: eventObject.uuid,
          inputDeviceElementId,
        });
      }
    );

    const root = new Object3D();
    root.addEventListener("press", ({ inputDeviceElementId, eventObject }) => {
      actualEvents.push({
        type: "press",
        objectUUID: eventObject.uuid,
        inputDeviceElementId,
      });
    });

    root.add(parent);
    parent.add(child);

    inputDevice.update(
      [
        {
          object: child,
          capturedObject: parent,
          distance: 0,
          intersections: [],
          point: new Vector3(),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
        },
      ],
      [1],
      1
    );

    expect(actualEvents).to.deep.equal([
      { type: "press", objectUUID: parent.uuid, inputDeviceElementId: 1 },
      { type: "press", objectUUID: root.uuid, inputDeviceElementId: 1 },
    ] satisfies Array<EventLog>);
  });

  it("should call onIntersect", () => {
    const intersectionsList: Array<ReadonlyArray<XIntersection>> = [];
    const inputDevice = new MockInputDevice(
      1,
      undefined,
      undefined,
      undefined,
      (intersections) => intersectionsList.push(intersections)
    );
    const object = new Object3D();
    const intersections = [
      {
        object: object,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ];
    inputDevice.update(intersections);
    inputDevice.update([]);

    expect(intersectionsList).to.deep.equal([intersections, []]);
  });

  it("should filter intersections", () => {
    const intersectionsList: Array<ReadonlyArray<XIntersection>> = [];
    const inputDevice = new MockInputDevice(
      1,
      undefined,
      undefined,
      undefined,
      (intersections) => intersectionsList.push(intersections),
      (is) => is.filter((i) => false)
    );
    const intersections = [
      {
        object: new Object3D(),
        distance: 0,
        point: new Vector3(),
        intersections: [],
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
      {
        object: new Object3D(),
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ];
    inputDevice.update(intersections);
    inputDevice.update([]);

    expect(intersectionsList).to.deep.equal([[], []]);
  });

  it("should not select (click) when dragged", () => {
    const inputDevice = new MockInputDevice(
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      (id) => id === 1
    );
    const actualEvents: Array<EventLog> = [];
    const object = new Object3D();
    object.addEventListener("select", (event) => {
      actualEvents.push({
        type: "select",
        objectUUID: object.uuid,
        inputDeviceElementId: (event as any).inputDeviceElementId,
      });
    });

    //enter and press
    inputDevice.update(
      [
        {
          object: object,
          distance: 0,
          intersections: [],
          point: new Vector3(0, 0, 0),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
        },
      ],
      [1, 2],
      1,
      2
    );
    //release
    inputDevice.update(
      [
        {
          object: object,
          distance: 0,
          intersections: [],
          point: new Vector3(0, 100, 0),
          inputDevicePosition: new Vector3(),
          inputDeviceRotation: new Quaternion(),
          localPoint: new Vector3(),
          pointOnFace: new Vector3(),
        },
      ],
      []
    );

    expect(actualEvents).to.deep.equal([
      {
        type: "select",
        objectUUID: object.uuid,
        inputDeviceElementId: 2,
      },
    ] satisfies Array<EventLog>);
  });
});

describe("translator's onMissed... events", () => {
  it("should not fire any missed events", () => {
    const actualEvents: Array<string> = [];
    const inputDevice = new MockInputDevice(
      1,
      () => actualEvents.push("pressMissed"),
      () => actualEvents.push("releaseMissed"),
      () => actualEvents.push("selectMissed")
    );
    const object = new Object3D();

    inputDevice.update([
      {
        object,
        distance: 0,
        intersections: [],
        point: new Vector3(),
        inputDevicePosition: new Vector3(),
        inputDeviceRotation: new Quaternion(),
        localPoint: new Vector3(),
        pointOnFace: new Vector3(),
      },
    ]);
    inputDevice.update(undefined, new Map([[object, [101]]]), 101);
    inputDevice.update(undefined, new Map());

    expect(actualEvents).to.deep.equal([]);
  });
  it("should fire onPressMissed", () => {
    const actualEvents: Array<string> = [];
    const inputDevice = new MockInputDevice(
      1,
      () => actualEvents.push("pressMissed"),
      () => actualEvents.push("releaseMissed"),
      () => actualEvents.push("selectMissed")
    );

    inputDevice.update([], [101], 101);

    expect(actualEvents).to.deep.equal(["pressMissed"]);
  });
  it("should fire onReleaseMissed", () => {
    const actualEvents: Array<string> = [];
    const inputDevice = new MockInputDevice(
      1,
      () => actualEvents.push("pressMissed"),
      () => actualEvents.push("releaseMissed")
    );

    inputDevice.update([], [101]);
    inputDevice.update([], []);

    expect(actualEvents).to.deep.equal(["releaseMissed"]);
  });
  it("should not trigger select because the pointer was dragged into the void", () => {
    const actualEvents: Array<string> = [];
    const inputDevice = new MockInputDevice(1, undefined, undefined, () =>
      actualEvents.push("selectMissed")
    );

    inputDevice.update([], [1]);

    inputDevice.position.x = 100;

    inputDevice.update(undefined, []);

    expect(actualEvents).to.deep.equal([]);
  });

  it("should trigger select because the pointer was not dragged into the void", () => {
    const actualEvents: Array<string> = [];
    const inputDevice = new MockInputDevice(1, undefined, undefined, () =>
      actualEvents.push("selectMissed")
    );

    inputDevice.update([], [1], 1);

    inputDevice.update(undefined, []);

    expect(actualEvents).to.deep.equal(["selectMissed"]);
  });
});
