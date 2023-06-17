import { expect } from "chai";
import {
  intersectRayFromCamera,
  intersectRayFromCameraCapturedEvents,
  intersectRayFromCapturedEvents,
  intersectRayFromObject,
} from "../../src/intersections/ray.js";
import {
  BoxGeometry,
  Euler,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Plane,
  Quaternion,
  Vector2,
  Vector3,
} from "three";
import { EventDispatcher } from "../../src/index.js";

export const mockEventDispatcher = {
  hasEventHandlers: () => true,
} as any as EventDispatcher<Event, any>;

const worldPosition = new Vector3();
const worldRotation = new Quaternion();

describe("ray intersections", () => {
  it("should have no intersections", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    from.rotation.y = Math.PI / 2;
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry());
    group.add(mesh1);
    mesh1.position.set(3, 3, 1);
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry());
    group.add(mesh2);
    mesh2.position.set(-3, 1, 1);
    mesh2.updateMatrixWorld();

    from.getWorldPosition(worldPosition);
    from.getWorldQuaternion(worldRotation);

    const intersections = intersectRayFromObject(
      worldPosition,
      worldRotation,
      group,
      mockEventDispatcher,
      false
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([]);
  });
  it("should have one intersections", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    from.rotation.y = Math.PI / 2;
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry());
    group.add(mesh1);
    mesh1.position.set(3, 1, 1);
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry());
    group.add(mesh2);
    mesh2.position.set(-3, 1, 1);
    mesh2.updateMatrixWorld();

    from.getWorldPosition(worldPosition);
    from.getWorldQuaternion(worldRotation);

    const intersections = intersectRayFromObject(
      worldPosition,
      worldRotation,
      group,
      mockEventDispatcher,
      false
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([mesh1.uuid]);
  });
  it("should have intersections with all objects sorted by distance", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    from.rotation.y = Math.PI / 2;
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry());
    group.add(mesh1);
    mesh1.position.set(7, 1, 1);

    const mesh2 = new Mesh(new BoxGeometry());
    group.add(mesh2);
    mesh2.position.set(6, 1, 1);

    const mesh3 = new Mesh(new BoxGeometry());
    group.add(mesh3);
    mesh3.position.set(3, 1, 1);

    mesh1.updateMatrixWorld();
    mesh2.updateMatrixWorld();
    mesh3.updateMatrixWorld();

    from.getWorldPosition(worldPosition);
    from.getWorldQuaternion(worldRotation);

    const intersections = intersectRayFromObject(
      worldPosition,
      worldRotation,
      group,
      mockEventDispatcher,
      false
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([
      mesh3.uuid,
      mesh2.uuid,
      mesh1.uuid,
    ]);
  });
  it("should have intersection with closest from parent mesh and child mesh", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    from.rotation.y = Math.PI / 2;

    const parent = new Mesh(new BoxGeometry());
    parent.position.set(6, 1, 1);

    const child = new Mesh(new BoxGeometry());
    parent.add(child);
    child.position.set(-3, 0, 0); //therefore at (3,1,1)

    parent.updateMatrixWorld();
    child.updateMatrixWorld();

    from.getWorldPosition(worldPosition);
    from.getWorldQuaternion(worldRotation);

    const intersections = intersectRayFromObject(
      worldPosition,
      worldRotation,
      parent,
      mockEventDispatcher,
      false
    );
    expect(intersections.map((i) => i.distance)).to.deep.equal([1.5, 4.5]);
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([
      child.uuid,
      parent.uuid,
    ]);
  });

  it("should sort intersections", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    from.rotation.y = Math.PI / 2;
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry());
    group.add(mesh1);
    mesh1.position.set(7, 1, 1);

    const mesh2 = new Mesh(new BoxGeometry());
    group.add(mesh2);
    mesh2.position.set(6, 1, 1);

    const mesh3 = new Mesh(new BoxGeometry());
    group.add(mesh3);
    mesh3.position.set(3, 1, 1);

    mesh1.updateMatrixWorld();
    mesh2.updateMatrixWorld();
    mesh3.updateMatrixWorld();

    from.getWorldPosition(worldPosition);
    from.getWorldQuaternion(worldRotation);

    const intersections = intersectRayFromObject(
      worldPosition,
      worldRotation,
      group,
      mockEventDispatcher,
      false
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([
      mesh3.uuid,
      mesh2.uuid,
      mesh1.uuid,
    ]);
  });
  it("should compute intersections from camera", () => {
    const from = new PerspectiveCamera(180);

    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry());
    group.add(mesh1);
    mesh1.position.set(3, 1, 1);
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry());
    group.add(mesh2);
    mesh2.position.set(-3, 1, 1);
    mesh2.updateMatrixWorld();

    from.lookAt(mesh2.position);
    from.rotateY(-Math.PI / 2); //rotate 90° deg to right
    from.updateMatrixWorld();

    const intersections = intersectRayFromCamera(
      from,
      new Vector2(-1), //rotate 90° deg to left
      group,
      mockEventDispatcher,
      false,
      new Vector3(),
      new Quaternion()
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([mesh2.uuid]);
  });

  it("should filter clipped from camera", () => {
    const from = new PerspectiveCamera(180);

    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry());
    group.add(mesh1);
    mesh1.position.set(-3, 1, 1);
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry());
    group.add(mesh2);
    mesh2.position.set(-3, 1, 1);
    mesh2.updateMatrixWorld();

    (mesh2.material as MeshBasicMaterial).clippingPlanes = [
      new Plane(new Vector3(1, 0, 0), -100),
    ];

    from.lookAt(mesh2.position);
    from.rotateY(-Math.PI / 2); //rotate 90° deg to right
    from.updateMatrixWorld();

    const intersections = intersectRayFromCamera(
      from,
      new Vector2(-1), //rotate 90° deg to left
      group,
      mockEventDispatcher,
      true,
      new Vector3(),
      new Quaternion()
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([mesh1.uuid]);
  });
});

describe("ray intersections for captured events", () => {
  it("should return new intersections for all captured objects", () => {
    const object1 = new Object3D();
    const object2 = new Object3D();
    const intersections = intersectRayFromCapturedEvents(
      new Vector3(),
      new Quaternion(),
      new Map([
        [
          object1,
          {
            distance: 0,
            inputDevicePosition: new Vector3(),
            inputDeviceRotation: new Quaternion(),
            object: object1,
            point: new Vector3(),
          },
        ],
        [
          object2,
          {
            distance: 0,
            inputDevicePosition: new Vector3(),
            inputDeviceRotation: new Quaternion(),
            object: object2,
            point: new Vector3(),
          },
        ],
      ])
    );
    expect(intersections.map((i) => i.object)).to.deep.equal([
      object1,
      object2,
    ]);
  });
  it("should target the intersections directly to the captured objects", () => {
    const object1 = new Object3D();
    const object2 = new Object3D();
    const object3 = new Object3D();
    const object4 = new Object3D();
    const intersections = intersectRayFromCapturedEvents(
      new Vector3(),
      new Quaternion(),
      new Map([
        [
          object3,
          {
            distance: 0,
            inputDevicePosition: new Vector3(),
            inputDeviceRotation: new Quaternion(),
            object: object1,
            point: new Vector3(),
          },
        ],
        [
          object4,
          {
            distance: 0,
            inputDevicePosition: new Vector3(),
            inputDeviceRotation: new Quaternion(),
            object: object2,
            point: new Vector3(),
          },
        ],
      ])
    );
    expect(intersections.map((i) => i.capturedObject)).to.deep.equal([
      object3,
      object4,
    ]);
  });
  it("should move the intersection point in relation to the rays movement", () => {
    const object = new Object3D();
    const intersections = intersectRayFromCapturedEvents(
      new Vector3(1, 0, 0), //move 1 to right
      new Quaternion().setFromEuler(new Euler(0, Math.PI / 2, 0)), //rotate 90° to right
      new Map([
        [
          object,
          {
            distance: 1,
            inputDevicePosition: new Vector3(0, 0, 0),
            inputDeviceRotation: new Quaternion(),
            object: object,
            point: new Vector3(0, 0, 1),
          },
        ],
      ])
    );
    expect(intersections[0].point.x).be.closeTo(2, 0.0001);
    expect(intersections[0].point.y).be.closeTo(0, 0.0001);
    expect(intersections[0].point.z).be.closeTo(0, 0.0001);
  });

  it("should move the intersection point in relation to the camera movement", () => {
    const from = new PerspectiveCamera(90);

    from.rotation.y = Math.PI;
    from.position.x = 1; //move 1 to right
    from.updateMatrixWorld();

    const object = new Object3D();

    const intersections = intersectRayFromCameraCapturedEvents(
      from,
      new Vector2(-1, 0), //rotate 45° to right
      new Map([
        [
          object,
          {
            distance: 1,
            distanceViewPlane: 1,
            inputDevicePosition: new Vector3(0, 0, 0),
            inputDeviceRotation: new Quaternion(),
            object: object,
            point: new Vector3(0, 0, 1),
          },
        ],
      ]),
      new Vector3(),
      new Quaternion()
    );

    expect(intersections[0].point.x).be.closeTo(2, 0.0001);
    expect(intersections[0].point.y).be.closeTo(0, 0.0001);
    expect(intersections[0].point.z).be.closeTo(1, 0.0001);
  });
});
