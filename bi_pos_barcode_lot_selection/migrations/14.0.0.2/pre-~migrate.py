from openupgradelib import openupgrade

@openupgrade.migrate()
def migrate(env, version):
    print('hello from pre-migration of bi_pos_barcode_lot_selection!')
