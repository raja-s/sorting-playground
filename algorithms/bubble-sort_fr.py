valeurs = [3, 7, 1, 5, 2, 8, 9, 4, 6] #l#

n = len(valeurs) #t#

# Échanger les éléments aux indices k et l
def echanger(k, l): #s#
    valeurs[k],valeurs[l] = valeurs[l],valeurs[k]

for i in range(n - 1, 0, -1): #tv(2)#
    for j in range(i): #tv(1)#
        if valeurs[j] > valeurs[j + 1]:
            echanger(j, j + 1)
