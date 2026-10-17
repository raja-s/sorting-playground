valeurs = [3, 7, 1, 5, 2, 8, 9, 4, 6] #l#

n = len(valeurs) #t#

# Enlever l'élément à l'indice k
# et le réinsérer à l'indice l
def reinserer(k, l): #s#
    valeurs.insert(l, valeurs.pop(k))

for i in range(1, n): #tv(2)#
    index_insertion = i #t#
    for j in range(i - 1, -1, -1): #tv(1)#
        if valeurs[j] > valeurs[i]:
            index_insertion = j
        else:
            break
    reinserer(i, index_insertion)
