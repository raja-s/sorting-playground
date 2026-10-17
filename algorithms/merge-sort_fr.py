valeurs = [18, 37,  3, 13, 10, 11, 31,  7, 17, 33,
            6, 38,  4, 14, 35, 26, 22, 39,  9, 25,
           19,  5,  2, 12, 23, 24,  1,  8, 28, 30,
           36, 16, 34, 20, 15, 29, 27, 32, 40, 21] #l#

n = len(valeurs) #t#

# Enlever l'élément à l'indice k
# et le réinsérer à l'indice l
def reinserer(k, l): #s#
    valeurs.insert(l, valeurs.pop(k))

def fusionner(debut, milieu, fin): #tv(debut:1,milieu:2,fin:4)#
    milieu_debut = milieu + 1 #tv(3)#

    if valeurs[milieu] <= valeurs[milieu_debut]:
        return

    while debut <= milieu and milieu_debut <= fin:
        if valeurs[debut] <= valeurs[milieu_debut]:
            debut += 1
        else:
            reinserer(milieu_debut, debut)
            debut += 1
            milieu += 1
            milieu_debut += 1

def tri_fusion(debut, fin): #td(debut-fin)#
    if debut >= fin:
        return

    milieu = debut + (fin - debut) // 2 #t#

    tri_fusion(debut, milieu)
    tri_fusion(milieu + 1, fin)

    fusionner(debut, milieu, fin)

tri_fusion(0, n - 1)
