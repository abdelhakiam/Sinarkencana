from openupgradelib import openupgrade

@openupgrade.migrate()
def migrate(env, version):
    print('hello from end-migration/end-upgrade of dashboard_pos!')
