valeurs = [18, 37,  3, 13, 10, 11, 31,  7, 17, 33,
            6, 38,  4, 14, 35, 26, 22, 39,  9, 25,
           19,  5,  2, 12, 23, 24,  1,  8, 28, 30,
           36, 16, 34, 20, 15, 29, 27, 32, 40, 21] #l#

n = len(valeurs) #t#

# Échanger les éléments aux indices k et l
def echanger(k, l): #s#
    valeurs[k],valeurs[l] = valeurs[l],valeurs[k]

def construire_tas(p, q): #tv(p:2,q:3)d(p-q)#
    index_maximum = p #tv(1)#
    index_gauche = 2 * p + 1 #t#
    index_droite = index_gauche + 1 #t#

    if index_gauche <= q and \
            valeurs[index_gauche] > valeurs[index_maximum]:
        index_maximum = index_gauche

    if index_droite <= q and \
            valeurs[index_droite] > valeurs[index_maximum]:
        index_maximum = index_droite

    if index_maximum != p:
        echanger(p, index_maximum)
        construire_tas(index_maximum, q)

for i in range(n // 2 - 1, -1, -1): #t#
    construire_tas(i, n - 1)

for i in range(n - 1, 0, -1): #t#
    echanger(0, i)
    construire_tas(0, i - 1)
