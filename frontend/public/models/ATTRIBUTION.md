# anatomy.glb

Derived from **BodyParts3D, © The Database Center for Life Science (DBCLS)**,
https://dbarchive.biosciencedbc.jp/en/bodyparts3d/ — version BP3D 4.0 ("is-a" tree, `isa_BP3D_4.0_obj_99.zip`).

**License.** The database's license page (last updated 2025-02-27) states the database is licensed under
**Creative Commons Attribution 4.0 International (CC BY 4.0)**, with the attribution
"BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International".
The OBJ files themselves (dated 2011–2013) still carry the older notice, *CC Attribution-Share Alike 2.1
Japan*. Both permit commercial use with attribution; CC BY-SA would additionally require this derived model
to be shared under the same license. Confirm with DBCLS if the distinction matters for your use.

**Changes made** (`scripts/anatomy/build-model.mjs`): selected skeletal muscles and all bones; converted from
millimetres/Z-up to metres/Y-up; merged parts per muscle and side; simplified with meshoptimizer
(~18% of triangles); recomputed smooth normals; quantized and meshopt-compressed; recoloured.

Not included in BP3D 4.0, so not in this model: latissimus dorsi, rectus abdominis.
