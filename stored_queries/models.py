

def generate():
    import build_models
    datamodel = build_models.get_datamodel()
    tables = build_models.make_tables(datamodel)
    classes = build_models.make_classes(datamodel)
    build_models.map_classes(datamodel, tables, classes)
    return tables, classes

tables, classes = generate()
del generate

globals().update(classes)


