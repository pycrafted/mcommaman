"""
Le rôle « préparatrice » disparaît.

La boutique ne distingue pas deux niveaux d'accès au back-office : une gérante
en fait entrer une autre, et c'est tout. Le rôle intermédiaire n'a jamais servi.

Le passage se fait en deux temps parce que les `choices` d'un CharField ne sont
pas tenus par la base : retirer la valeur du modèle sans toucher aux lignes
laisserait un compte « préparatrice » en place avec un rôle que plus rien ne
reconnaît — `est_equipe` répondrait faux et la personne se retrouverait dehors
sans que rien ne le signale. On promeut donc avant de retirer. Aucune ligne
n'est concernée dans la base de développement ; ailleurs, on ne sait pas.
"""

from django.db import migrations, models


def promouvoir(apps, schema_editor):
    Utilisateur = apps.get_model("clientele", "Utilisateur")
    Utilisateur.objects.filter(role="preparatrice").update(role="gerante")


def retrograder(apps, schema_editor):
    """
    Le retour en arrière ne rend rien.

    Une gérante d'origine et une préparatrice promue sont devenues la même
    chose : les distinguer demanderait une trace qu'on n'a pas gardée. Revenir
    en arrière laisse donc tout le monde gérante, ce qui est sans danger — le
    rôle existe de nouveau, personne ne perd son accès.
    """


class Migration(migrations.Migration):

    dependencies = [
        ('clientele', '0002_remove_utilisateur_newsletter'),
    ]

    operations = [
        migrations.RunPython(promouvoir, retrograder),
        migrations.AlterField(
            model_name='utilisateur',
            name='role',
            field=models.CharField(choices=[('cliente', 'Cliente'), ('gerante', 'Gérante')], default='cliente', max_length=16),
        ),
    ]
