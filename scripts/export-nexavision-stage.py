"""Prepare the authored Nexavision Blender scene for the browser.

Run with Blender 4.2+:
  blender --background <stage.blend> --python scripts/export-nexavision-stage.py -- <output.glb>

The source .blend is never modified. Blender-only controls, lights, cameras and
volumes are intentionally rebuilt in the React/Three.js runtime.
"""

import math
import os
import sys

import bpy


def output_path():
    args = sys.argv
    if "--" not in args or len(args[args.index("--") + 1 :]) != 1:
        raise SystemExit("Expected exactly one output GLB path after --")
    return os.path.abspath(args[args.index("--") + 1])


def collection_tag(obj):
    names = [collection.name for collection in obj.users_collection]
    return names[0] if names else "UNASSIGNED"


def remove_blender_runtime_objects(scene):
    removable = []
    for obj in list(scene.objects):
        if obj.type in {"LIGHT", "CAMERA"}:
            removable.append(obj)
            continue
        lower = obj.name.lower()
        material_names = [slot.material.name.lower() for slot in obj.material_slots if slot.material]
        is_volume_proxy = any("air | thin scattering" in name or "procedural volume" in name for name in material_names)
        if (
            obj.name == "NEXA | MASTER CONTROL"
            or "mist | bounded" in lower
            or "air volume" in lower
            or "arena atmosphere" in lower
            or is_volume_proxy
        ):
            removable.append(obj)
    for obj in removable:
        bpy.data.objects.remove(obj, do_unlink=True)


def simplify_material(material):
    name = material.name.lower()
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])

    base = (0.025, 0.035, 0.055, 1.0)
    metallic = 0.2
    roughness = 0.46
    emission = (0.0, 0.0, 0.0, 1.0)
    emission_strength = 0.0

    if "midnight" in name or "obsidian" in name or "charcoal" in name:
        base, metallic, roughness = (0.012, 0.022, 0.038, 1.0), 0.62, 0.28
    elif "seat" in name or "velvet" in name or "leather" in name:
        base, metallic, roughness = (0.014, 0.027, 0.052, 1.0), 0.05, 0.76
    elif "champagne" in name or "pearl" in name:
        base, metallic, roughness = (0.27, 0.18, 0.08, 1.0), 0.72, 0.3
    elif "wing backs" in name:
        base, metallic, roughness = (0.024, 0.035, 0.16, 1.0), 0.66, 0.32
    elif "main led" in name:
        base, metallic, roughness = (0.006, 0.009, 0.014, 1.0), 0.0, 0.82
        emission, emission_strength = (0.006, 0.009, 0.014, 1.0), 0.02
    elif "side led" in name:
        base, metallic, roughness = (0.02, 0.045, 0.08, 1.0), 0.08, 0.44
        emission, emission_strength = (0.03, 0.16, 0.3, 1.0), 0.6
    elif "main luminous" in name or "startup lens" in name:
        base, metallic, roughness = (0.025, 0.12, 0.18, 1.0), 0.08, 0.34
        emission, emission_strength = (0.08, 0.42, 0.95, 1.0), 2.0
    elif "accent luminous" in name or "warm pearl contour" in name:
        base, metallic, roughness = (0.18, 0.07, 0.02, 1.0), 0.12, 0.34
        emission, emission_strength = (1.0, 0.22, 0.04, 1.0), 2.0
    elif "moving amber" in name:
        base, metallic, roughness = (0.1, 0.035, 0.005, 1.0), 0.08, 0.4
        emission, emission_strength = (1.0, 0.16, 0.025, 1.0), 1.8
    elif "unlit edge" in name:
        base, metallic, roughness = (0.025, 0.034, 0.055, 1.0), 0.66, 0.3

    shader.inputs["Base Color"].default_value = base
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Emission Color"].default_value = emission
    shader.inputs["Emission Strength"].default_value = emission_strength


def convert_curves_and_text(scene):
    for obj in list(scene.objects):
        obj["nexa_group"] = collection_tag(obj)
        if obj.type not in {"CURVE", "FONT"}:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target="MESH")


def clear_animation(scene):
    scene.animation_data_clear()
    for obj in scene.objects:
        obj.animation_data_clear()
        for data in (getattr(obj, "data", None),):
            if data and hasattr(data, "animation_data_clear"):
                data.animation_data_clear()
        for constraint in list(obj.constraints):
            obj.constraints.remove(constraint)


target = output_path()
os.makedirs(os.path.dirname(target), exist_ok=True)
scene = bpy.context.scene
scene.frame_set(scene.get("nexa_intro_end", 350))
bpy.context.view_layer.update()

remove_blender_runtime_objects(scene)
convert_curves_and_text(scene)
clear_animation(scene)
for material in bpy.data.materials:
    simplify_material(material)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=target,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    export_extras=True,
    export_materials="EXPORT",
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=12,
)

size_mb = os.path.getsize(target) / (1024 * 1024)
print(f"NEXAVISION_GLTF_EXPORTED={target}")
print(f"NEXAVISION_GLTF_SIZE_MB={size_mb:.2f}")
