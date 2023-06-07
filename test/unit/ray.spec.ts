import { expect } from "chai";
import {
  intersectRayFromCamera,
  intersectRayFromObject,
} from "../../src/intersections/ray.js";
import {
  BoxGeometry,
  Group,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Vector2,
} from "three";
import { EventDispatcher } from "../../src/index.js";

export const mockEventDispatcher = {
  hasEventHandlers: () => true,
} as any as EventDispatcher<Event>;

describe("ray intersections", () => {
  it("should have no intersections", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    from.rotation.y = Math.PI / 2;
    const group = new Group();
    const mesh = new Mesh(new BoxGeometry());
    mesh.position.set(-1, 1, 1);
    const intersections = intersectRayFromObject(
      from,
      group,
      mockEventDispatcher
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

    const intersections = intersectRayFromObject(
      from,
      group,
      mockEventDispatcher
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

    const intersections = intersectRayFromObject(
      from,
      group,
      mockEventDispatcher
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
    child.position.set(3, 1, 1);

    parent.updateMatrixWorld();
    child.updateMatrixWorld();

    const intersections = intersectRayFromObject(
      from,
      parent,
      mockEventDispatcher
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([child.uuid]);
  });
  it("should filter intersections", () => {
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

    const intersections = intersectRayFromObject(
      from,
      group,
      mockEventDispatcher,
      (is) => is.filter((i) => i.object != mesh2)
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([
      mesh3.uuid,
      mesh1.uuid,
    ]);
  });
  it("should compute intersections from camera", () => {
    const from = new PerspectiveCamera();

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
    from.updateMatrixWorld();

    const intersections = intersectRayFromCamera(
      from,
      new Vector2(),
      group,
      mockEventDispatcher
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([mesh2.uuid]);
  });
});
