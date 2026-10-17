valeurs = [3, 7, 1, 5, 2, 8, 9, 4, 6] #l#

n = len(valeurs) #t#

# Échanger les éléments aux indices k et l
def echanger(k, l): #s#
    valeurs[k],valeurs[l] = valeurs[l],valeurs[k]

for i in range(n - 1): #tv(2)#
    index_minimum = i #t#
    for j in range(i + 1, n): #tv(1)#
        if valeurs[j] < valeurs[index_minimum]:
            index_minimum = j
    echanger(index_minimum, i)
