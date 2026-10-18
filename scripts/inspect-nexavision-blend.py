import json
import bpy
from mathutils import Vector


def serializable(value):
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    try:
        return list(value)
    except TypeError:
        return str(value)


scene = bpy.context.scene
objects = list(scene.objects)
meshes = [obj for obj in objects if obj.type == "MESH"]
lights = [obj for obj in objects if obj.type == "LIGHT"]
cameras = [obj for obj in objects if obj.type == "CAMERA"]
controller = scene.objects.get("NEXA | MASTER CONTROL")

world_corners = [obj.matrix_world @ Vector(corner) for obj in objects if obj.type in {"MESH", "CURVE", "FONT"} for corner in obj.bound_box]
world_min = [min(point[index] for point in world_corners) for index in range(3)]
world_max = [max(point[index] for point in world_corners) for index in range(3)]

report = {
    "scene": scene.name,
    "frame_start": scene.frame_start,
    "frame_end": scene.frame_end,
    "fps": scene.render.fps,
    "collections": [collection.name for collection in bpy.data.collections],
    "object_counts": {},
    "mesh_totals": {
        "objects": len(meshes),
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
        "polygons": sum(len(obj.data.polygons) for obj in meshes),
    },
    "world_bounds": {"min": world_min, "max": world_max},
    "largest_meshes": [
        {
            "name": obj.name,
            "vertices": len(obj.data.vertices),
            "polygons": len(obj.data.polygons),
            "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
        }
        for obj in sorted(meshes, key=lambda item: len(item.data.polygons), reverse=True)[:40]
    ],
    "lights": [
        {
            "name": obj.name,
            "type": obj.data.type,
            "energy": obj.data.energy,
            "color": list(obj.data.color),
            "shadows": obj.data.use_shadow,
        }
        for obj in lights
    ],
    "cameras": [
        {
            "name": obj.name,
            "location": list(obj.location),
            "rotation_euler": list(obj.rotation_euler),
            "lens": obj.data.lens,
        }
        for obj in cameras
    ],
    "materials": [material.name for material in bpy.data.materials],
    "images": [
        {
            "name": image.name,
            "filepath": image.filepath,
            "size": list(image.size),
            "packed": image.packed_file is not None,
        }
        for image in bpy.data.images
    ],
    "controller": {key: serializable(controller[key]) for key in controller.keys()} if controller else None,
    "animation_actions": [action.name for action in bpy.data.actions],
}

for obj in objects:
    report["object_counts"][obj.type] = report["object_counts"].get(obj.type, 0) + 1

print("NEXAVISION_BLEND_REPORT_BEGIN")
print(json.dumps(report, ensure_ascii=False, indent=2))
print("NEXAVISION_BLEND_REPORT_END")
