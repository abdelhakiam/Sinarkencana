from openupgradelib import openupgrade

@openupgrade.migrate()
def migrate(env, version):
    print('hello from pre-migration/pre-upgrade of dashboard_pos!')
