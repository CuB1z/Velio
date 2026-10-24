import osmium

from tools.merge_regions import merge


def write(path, nodes, ways):
    writer = osmium.SimpleWriter(str(path))
    for node_id, location in nodes.items():
        writer.add_node(
            osmium.osm.mutable.Node(id=node_id, location=location, version=1, tags={})
        )
    for way_id, refs in ways.items():
        writer.add_way(
            osmium.osm.mutable.Way(
                id=way_id, nodes=refs, version=1, tags={"highway": "track"}
            )
        )
    writer.close()


def test_border_objects_present_in_both_extracts_are_kept_once(tmp_path):
    big = tmp_path / "big.osm.pbf"
    small = tmp_path / "small.osm.pbf"
    write(
        big, {1: (0.0, 0.0), 2: (0.001, 0.0), 4: (0.0, 0.001)}, {10: [1, 2], 12: [1, 4]}
    )
    write(small, {2: (0.001, 0.0), 3: (0.002, 0.0)}, {10: [1, 2], 11: [2, 3]})
    out = tmp_path / "merged.osm.pbf"

    merge([small, big], out)

    seen: dict[str, list[int]] = {"n": [], "w": []}
    for obj in osmium.FileProcessor(str(out)):
        seen[obj.type_str()].append(obj.id)
    assert seen == {"n": [1, 2, 3, 4], "w": [10, 11, 12]}
