## Deno et le chat

> Un peu de contexte : Deno se positionne comme le futur remplaçant (ou complément) de NodeJS, avec des arguments de performances, sécurité, et TypeScript comme langage de première classe.
>
> Il s'agit d'une refondation complète, ambitieuse et pleine de promesses, loin d'un simple fork de NodeJS, dont l'objectif est de devenir à terme la plateforme d'exécution JS de référence en dehors du navigateur.

Pour découvrir et s'approprier une nouvelle technologie, un nouveau framework ou langage, rien de tel que s'y frotter directement avec une première réalisation.

C'est précisément ce qu'avait entrepris [Ryan Dahl](https://en.wikipedia.org/wiki/Ryan_Dahl) il y a maintenant une dizaine d'années avec [NodeJS](https://fr.wikipedia.org/wiki/Node.js).

Alors, à défaut d'être original, j'ai choisi ici de vous proposer un exercice similaire qui permet de toucher du doigt l'essentiel de Deno et démarrer du bon pied avec ce formidable écosystème en pleine ébullition.

Nous allons réaliser sous la forme d'un [kata](https://fr.wikipedia.org/wiki/Kata_(programmation)), un serveur de chat TCP avec Deno en 8 étapes et moins de 50 lignes.

Pour suivre ce kata, vous avez simplement besoin de :

*   [Deno](https://deno.land/manual@v1.28.3/getting_started/installation)

*   Un IDE : WebStorm, VsCode ou autre…


C'est parti !

Retrouver les sources du TP : [NijiDigital/deno-chat-server](https://github.com/NijiDigital/deno-chat-server).

### Étape 1 : un serveur TCP qui dit hello

Créons la version initiale de notre serveur qui doit écouter et commencer à interagir avec les connexions.

#### Objectifs :

*   Implémenter un serveur TCP qui binde le port 8765.

*   Tracer les nouvelles connexions.

*   Écrire 'Hello#ID!\\n' comme message de bienvenue à toute nouvelle connexion.


#### Réalisation :

*   Créer [./chat-server.ts](https://raw.githubusercontent.com/NijiDigital/deno-chat-server/516b71ed119a3a313c8552363f27ca6d663a4859/src/chat-server.ts) :

    ```typescript
    const port = 8765
    
    const listener = Deno.listen({ port })
    console.log(`Chat server is listening to port ${port}…`)
    
    for await (const conn of listener) {
      console.log(`New connection incoming: saying hello to #${conn.rid}`)
      const helloChunks = new TextEncoder().encode(`Hello #${conn.rid}!\n`)
      await conn.write(helloChunks)
    }
    ```

*   Lancer le serveur :

    ```shell
    $ deno run --watch --allow-net ./chat-server.ts
    Watcher Process started.
    Chat server is listening to port 8765…
    █
    ```

*   Interagir avec le serveur :

    ```shell
    $ nc localhost 8765
    Hello #4!
    $ █
    ```

*   Résultat dans la log du serveur :

    ```shell
    …
    New connection incoming: saying hello to #4
    █
    ```


> Remarques :
>
> *   Deno utilise beaucoup les async iterators, ce qui propose une forme de code assez élégante.
>
> *   Ce parti pris laisse peu de place à la programmation fonctionnelle et ampute légèrement la maîtrise de ce qui se passe sous le capot (on en verra une illustration plus tard…).
>
> *   Lors du lancement du serveur, on doit impérativement spécifier les autorisations à accorder, c'est un des aspects discriminants de Deno par rapport à NodeJS, la stratégie de sécurité est stricte ce qui est un très bon point pour son adoption en entreprise.
>

### Étape 2 : lire une ligne de texte depuis le réseau

Passer à une communication "full duplex", en lisant ce qui provient de la connexion.

#### Objectif :

*   Lire et tracer chaque ligne de texte envoyée par le client.


#### Réalisation :

Ajouter dans `./chat-server.ts` :

*   avant la `ligne 1` :

    ```typescript
      import { readLines } from 'https://deno.land/std@0.166.0/io/buffer.ts'
    ```

*   après la `ligne 11` :

    ```typescript
      for await (const line of readLines(conn)) {
        console.log('Received line:', line)
      }
    ```


> Remarque :
>
> *   La librairie standard fournit des fonctions pour faciliter l'utilisation des buffers.
>

> Question :
>
> *   Que se passe-t-il lorsque plusieurs clients se connectent ?
>

### Étape 3 : centraliser les dépendances Deno

On commence à utiliser des dépendances (même si pour l'instant il s'agit de la lib standard), il est temps de poser les bases d'un système qui centralise l'accès aux dépendances du projet et leurs versions.

#### Objectif :

*   Centraliser la gestion des dépendances et de leurs versions.


#### Réalisation :

*   Créer `./deps.ts` :

    ```typescript
    export { readLines } from 'https://deno.land/std@0.166.0/io/buffer.ts'
    ```

*   Dans `./chat-server.ts` remplacer la `ligne 1` :

    ```typescript
    import { readLines } from './deps.ts'
    ```


> Remarque :
>
> *   Centraliser les dépendances permet de les upgrader plus facilement et limite la duplication dans le code.
>
> *   ⚠️ Il se trouve que Deno a pris le parti de ne rien proposer pour gérer les dépendances.
>
> *   En réalité, ce choix a pour but de simplifier l'écosystème et maximiser les possibilités d'interactions entre modules, tout se fait en chargeant simplement les sources au runtime, qu'ils soient en JavaScript ou en TypeScript.
>
> *   L'organisation efficiente du chargement des dépendances est laissée totalement à la discrétion des développeurs.
>
> *   Une convention commence à s'installer avec `deps.ts`.
>

### Étape 4 : un serveur multi clients

Le serveur en l'état n'est pas capable de servir plusieurs connexions simultanément, il reste bloqué sur la première.

#### Objectif :

*   Débloquer le serveur.


#### Réalisation :

*   Déplacer le traitement dans une fonction dédiée non bloquante, en `ligne 5` :

    ```typescript
    const handleConn = async (conn: Deno.Conn) => {
      console.log(`New connection incoming: saying hello to #${conn.rid}`)
      const helloChunks = new TextEncoder().encode(`Hello #${conn.rid}!\n`)
      await conn.write(helloChunks)
      for await (const line of readLines(conn)) {
        console.log('Received line:', line)
      }
    }
    ```

*   Changer la boucle en `ligne 17` :

    ```typescript
    for await (const conn of listener) {
      void handleConn(conn)
    }
    ```


> Remarques :
>
> *   ⚠️ Il ne faut surtout pas bloquer la boucle de traitement des connexions.
>
> *   Ici, on utilise `void` pour expliciter le fait que l'on ne traite pas la promesse (fire & forget) afin de continuer à servir les autres connexions pendant le traitement.
>

### Étape 5 : gérer les connexions

Maintenant que le serveur est capable de servir plusieurs connexions, il serait judicieux de les gérer en maintenant une liste et rendre compte du nombre de chatters.

#### Objectifs :

*   Stocker les nouvelles connexions.

*   Tracer le nombre de chatters.


#### Réalisation :

*   Ajouter en `ligne 5` les connexions actives :

    ```typescript
    const connections: Deno.Conn[] = []
    ```

*   Ajouter en `ligne 9` un report des chatters :

    ```typescript
      console.log(`You are now ${connections.length} chatters`)
    ```

*   Ajouter en `ligne 21` l'ajout de chaque nouvelle connexion :

    ```typescript
    connections.push(conn)
    ```


> Question :
>
> *   Que se passe-t-il si un client ferme sa connexion ?
>

### Étape 6 : coucou le chat

La fonction de chat consiste à écouter ce que quelqu'un dit, et le transmettre aux autres (broadcast).

#### Objectifs :

*   Créer une fonction retournant les autres connexions à partir d'une connexion donnée.

*   Écrire aux autres le message reçu d'une connexion.


#### Réalisation :

*   Ajouter `ligne 7` pour obtenir les autres connexions :

    ```typescript
    const getOtherConnections = (conn: Deno.Conn): Deno.Conn[] => connections.filter(other => other !== conn)
    ```

*   Ajouter en `ligne 14` pour écrire aux autres connexions :


```typescript
  for await (const line of readLines(conn)) {
  const others = getOtherConnections(conn)
  const chunks = new TextEncoder().encode(`${line}\n`)
  await Promise.all(others.map(async (otherConn) => {
    console.log(`Message from #${conn.rid} to #${otherConn.rid}: ${line}`)
    await otherConn.write(chunks)
  }))
}
```

> Remarques :
>
> *   Il faut transformer le texte en buffer pour pouvoir l'écrire, là encore la librairie standard vient à la rescousse.
>

### Étape 7 : ne pas casser sa pipe

Au moindre problème, notre serveur crash…

Pour éviter ce phénomène, il faut gérer les erreurs, et en profiter pour supprimer les connexions corrompues.

#### Objectif :

*   Créer une fonction pour détruire une connexion défaillante.

*   Créer une fonction pour tracer le nombre de chatters.

*   Créer une fonction pour fermer une connexion silencieusement.


#### Réalisation :

*   Ajouter `ligne 9` :

    ```typescript
    const destroyConn = (conn: Deno.Conn) => {
      tryToClose(conn)
      const index = connections.indexOf(conn)
      if (index !== -1) {
        console.log(`Connection #${conn.rid} leaved`)
        connections.splice(index, 1)
        reportChatters()
      }
    }
    
    const reportChatters = () => {
      if (connections.length > 0) {
        console.log(`You are now ${connections.length} chatter${connections.length > 1 ? 's' : ''}`)
      } else {
        console.log(`No chatter connected`)
      }
    }
    
    const tryToClose = (conn: Deno.Conn) => {
      try {
        conn.close()
      } catch {
        // Do not remove
      }
    }
    ```

*   Afficher le nombre de chatters en ajoutant `ligne 37` :

    ```typescript
      reportChatters()
    ```

*   Gérer les erreurs et supprimer la connexion, en `ligne 45`

    ```typescript
          try {
            await otherConn.write(chunks)
          } catch (err) {
            console.warn(err.message)
            destroyConn(otherConn)
          }
    ```


> Remarques :
>
> *   Il s'agit ici de rester clean quant aux connexions que l'on gère, si l'on ne parvient pas à écrire, on tente de fermer silencieusement la connexion défaillante.
>
> *   ⚠️ Comme on ne dispose de rien pour gérer le cycle de vie d'une connexion, le seul moyen consiste à gérer les erreurs lors de tentatives d'écriture, et supprimer les connexions obsolètes le cas échéant.
>
> *   On peut espérer que dans un avenir proche cette situation va s'améliorer.
>

### Étape 8 & fin : aider le chat avec un watchdog

Il n'y a malheureusement aucun moyen simple de réagir à des événements concernant les connexions, Deno n'a rien prévu à cet effet.

Seule solution de repli : prévoir un watchdog.

#### Objectif :

*   Implémenter un timer responsable de la destruction des connexions non actives.


#### Réalisation :

*   Ajouter en `ligne 58` le watchdog :

    ```typescript
    const watchdogChunk = new Uint8Array({ length: 1 })
    setInterval(() => {
      connections.map(async (conn) => {
        try {
          await conn.write(watchdogChunk)
        } catch {
          destroyConn(conn)
        }
      })
    }, 100)
    console.log('Watch dog timer started')
    ```


> Remarque :
>
> *   ⚠️ Il n'est pas (encore) possible de capturer des événements concernant les connexions.
>

### Conclusion

Ce que nous avons vu durant ce petit voyage avec Deno :

*   Faire un petit serveur de chat minimaliste.

*   L'utilisation de l'API de network bas niveau (TCP), pas besoin d'un serveur HTTP pour cet exemple.

*   La simplicité d'utilisation de Deno, et quelques-uns de ses partis pris modernes.

*   Des limites dans l'API proposée dans sa version actuelle.


Si ça vous a plu et que vous aimeriez aller plus loin, vous trouverez dans notre repo [github.com/NijiDigital/deno-chat-server](https://github.com/NijiDigital/deno-chat-server/blob/main/src/tcp-chat-server.ts) une version plus aboutie du serveur avec quelques fonctionnalités sympas :

*   Support de commandes avec le préfixe `.` :

    *   `.nick johndoe` pour changer de pseudo

    *   `.shutdown` pour arrêter le serveur (à des fins pédagogiques!)

*   Support des nicknames

*   Support des mentions (avec le préfixe '@')


![](https://cdn.hashnode.com/res/hashnode/image/upload/v1670312844041/po9pvig2v.png align="left")

Sentez-vous libre de l'enrichir :-)

Rendez-vous pour un prochain "hands-on" sur d'autres aspects de Deno… !