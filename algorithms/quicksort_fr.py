valeurs = [18, 37,  3, 13, 10, 11, 31,  7, 17, 33,
            6, 38,  4, 14, 35, 26, 22, 39,  9, 25,
           19,  5,  2, 12, 23, 24,  1,  8, 28, 30,
           36, 16, 34, 20, 15, 29, 27, 32, 40, 21] #l#

n = len(valeurs) #t#

# Échanger les éléments aux indices k et l
def echanger(k, l): #s#
    valeurs[k],valeurs[l] = valeurs[l],valeurs[k]

def partitionner(debut, fin): #v(fin:3)#
    i = debut #tv(2)#
    for j in range(debut, fin): #tv(1)#
        if valeurs[j] <= valeurs[fin]:
            echanger(i, j)
            i += 1
    echanger(i, fin)
    return i

def tri_rapide(debut, fin): #td(debut-fin)#
    if debut < fin:
        index_pivot = partitionner(debut, fin) #tv(3)#
        tri_rapide(debut, index_pivot - 1)
        tri_rapide(index_pivot + 1, fin)

tri_rapide(0, n - 1)
