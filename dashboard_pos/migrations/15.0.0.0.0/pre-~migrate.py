from openupgradelib import openupgrade

@openupgrade.migrate()
def migrate(env, version):
    print('hello from post-migration/post-upgrade of dashboard_pos!')
