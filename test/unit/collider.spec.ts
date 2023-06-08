import { expect } from "chai";
import { Object3D, Group, Mesh, BoxGeometry } from "three";
import { mockEventDispatcher } from "./ray.spec.js";
import { intersectSphereFromObject } from "../../src/intersections/collider.js";

describe("sphere collider intersections", () => {
  it("should have no intersections", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry());
    group.add(mesh1);
    mesh1.position.set(3, 3, 1);
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry());
    group.add(mesh2);
    mesh2.position.set(-3, 1, 1);
    mesh2.updateMatrixWorld();

    const intersections = intersectSphereFromObject(
      from,
      0.5,
      0,
      group,
      mockEventDispatcher
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([]);
  });
  it("should have one intersections", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry(1, 1, 1));
    group.add(mesh1);
    mesh1.position.set(1.8, 1, 1); //0.8 offset from collider < collider radius (0.5) + mesh bounding box "radius" (0.5)
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry());
    group.add(mesh2);
    mesh2.position.set(-3, 1, 1);
    mesh2.updateMatrixWorld();

    const intersections = intersectSphereFromObject(
      from,
      0.5,
      0,
      group,
      mockEventDispatcher
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([mesh1.uuid]);
  });
  it("should have intersections with all objects sorted by distance", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry(1, 1, 1));
    group.add(mesh1);
    mesh1.position.set(1.9, 1, 1); //0.9 offset from collider < collider radius (0.5) + mesh bounding box "radius" (0.5)
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry(1, 1, 1));
    group.add(mesh2);
    mesh2.position.set(1, 0.5, 1); //0.5 offset
    mesh2.updateMatrixWorld();

    const intersections = intersectSphereFromObject(
      from,
      0.5,
      0,
      group,
      mockEventDispatcher
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([
      mesh2.uuid,
      mesh1.uuid,
    ]);
    expect(intersections[0].distance).be.closeTo(-0.5, 0.0001);
    expect(intersections[1].distance).be.closeTo(-0.1, 0.0001);
  });
  it("should have intersection with closest from parent mesh and child mesh", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);

    const parent = new Mesh(new BoxGeometry(1, 1, 1));
    parent.position.set(1.9, 1, 1); //distance -0.1

    const child = new Mesh(new BoxGeometry(1, 1, 1));
    parent.add(child);
    child.position.set(0.5, 1, 1); //distance -0.5

    parent.updateMatrixWorld();
    child.updateMatrixWorld();

    const intersections = intersectSphereFromObject(
      from,
      0.5,
      0,
      parent,
      mockEventDispatcher
    );
    expect(intersections[0].distance).be.closeTo(-0.5, 0.0001);
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([child.uuid]);
  });
  it("should filter intersections", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry(1, 1, 1));
    group.add(mesh1);
    mesh1.position.set(1.9, 1, 1); //0.9 offset from collider < collider radius (0.5) + mesh bounding box "radius" (0.5)
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry(1, 1, 1));
    group.add(mesh2);
    mesh2.position.set(1, 0.5, 1); //0.5 offset
    mesh2.updateMatrixWorld();

    const mesh3 = new Mesh(new BoxGeometry(1, 1, 1));
    group.add(mesh3);
    mesh3.position.set(1, 1, 0.2); //0.8 offset
    mesh3.updateMatrixWorld();

    const intersections = intersectSphereFromObject(
      from,
      0.5,
      0,
      group,
      mockEventDispatcher,
      (is) => is.filter((i) => i.object != mesh2)
    );
    expect(intersections.map((i) => i.object.uuid)).to.deep.equal([
      mesh3.uuid,
      mesh1.uuid,
    ]);
    expect(intersections[0].distance).be.closeTo(-0.2, 0.0001);
    expect(intersections[1].distance).be.closeTo(-0.1, 0.0001);
  });

  it("should intersect the face with the correct normal", () => {
    const from = new Object3D();
    from.position.set(1, 1, 1);
    const group = new Group();

    const mesh1 = new Mesh(new BoxGeometry(1, 1, 1));
    group.add(mesh1);
    mesh1.position.set(1.8, 1, 1); //0.8 offset from collider < collider radius (0.5) + mesh bounding box "radius" (0.5)
    mesh1.updateMatrixWorld();

    const mesh2 = new Mesh(new BoxGeometry());
    group.add(mesh2);
    mesh2.position.set(-3, 1, 1);
    mesh2.updateMatrixWorld();

    const [intersection] = intersectSphereFromObject(
      from,
      0.5,
      0,
      group,
      mockEventDispatcher
    );
    const {x,y,z} = intersection.point
    expect(x).be.closeTo(1.3, 0.0001);
    expect(y).be.closeTo(1, 0.0001);
    expect(z).be.closeTo(1, 0.0001);

    expect(intersection.face).to.not.be.undefined;
    const [nx, ny, nz] = intersection.face!.normal.toArray();
    expect(nx).be.closeTo(-1, 0.0001);
    expect(ny).be.closeTo(0, 0.0001);
    expect(nz).be.closeTo(0, 0.0001);
  });
});
