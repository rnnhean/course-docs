[00:00] hi and welcome on this lecture we will start get the created user and we will actually create an authentication token for our user with expert date and we want also to stitch the user ID inside of this token somehow you will see how to do this and first of all we want to get and install this package
[00:28] For get dot and after that we can go to the main and we can just game here The packaging name remember it's called get help slash joe got Go dot and alright and after that we can just game here and call the package right down here and After that we can just
[00:57] start load the mf we can just say come here and say load.nf file right and now we can just say f error and use this go.net
[01:26] and dot load if error we want to say not equal to 0 on that case we want to say log for example fatal and just say error loading dot
[01:56] and file right over cool here now we can just go to the OS controller and for now we just take that out alright and below this one we want to say get the new user if you remember at the last lecture
[02:23] we already get the this will return to us the created user ID and we can use this to get the new user and return it back all with all the user data we already have this data but we can just make sure or yeah just save all created user
[02:52] remember that the data that we have it is actually all the user data except we have this object without the ID so we can directly come here and say create a user pointer of models of this user model now the query
[03:20] will be person.m underscore id and the result result yep not inserted user id or I'm sorry inserted id where all
[03:45] what the error that we have we have missing key yeah the problem that this is not actually a comma yes this is a column but well now we can just come down here and say use our schema dot find on ctx query
[04:14] decode we want to decode the created users after that we want to create the token we can just store by say claims or equal to jwt.
[04:43] new claims we need to get in this JWT hit on quick fix yes this one that we are using now we can just came here and say JWT dot new what claims say JWT dot sign what method
[05:13] Sorry, sign. Signing actually. Yep, signing. What method? Which one? Want to use method HS265, yep.
[05:42] past gwt standard claims and then we can just skim here why we have a problem this undefined okay just hit save go back say go mod tidy
[06:12] Hit enter wait until this running. Okay, it's now showing give us in this undefined. Yep Very well now we can just pass the assure And here we can actually is touch the ID can just say created user
[06:42] dot id to hex very well xbar add we can just say time dot now time dot now dot want this to be after so we can just say add time
[07:08] this is not new this is now so change the A window ok ok ok ok ok ok we will change it to hex just wait for me at time dot hour times I just say 24 hours right after that we can just come here and say unix and we're cool right now
[07:37] very well before we move on we want to extract the secretary we can just come here and say jwt secret equal to os dot get nv and what is the nv
[08:03] id of name why this keep creating dot time anyway i just came here id of variable name was jwt-secret i just pass it here alright and after all we can just now create the token token i just ignored the error say claims
[08:31] dot sign in string array of plate of this jwt secret
[08:59] all right now after all we can just give here and say return or just return this back take this down and what we want to return I want to return on the result the created user
[09:23] we want also to return a token we want to return that token all right or do we have any kind of errors go token no we didn't need it just remove it and hit save okay cool now we'll just run our app one more time
[09:52] run main.go right now just go to the browser just copy all this refresh the page hit on tryout just directly you can paste this change this to s again change this to s just say iso
[10:21] last name can be su and I will just hit on execute as you can see this has been returned the you created user for us which is come from the database as well as the token all note that the token actually inside of this token we already started the user ID
[10:48] and we can verify from that that this user is authenticated to do whatever he asked to do or not at all I think that's all what we need to do on this lecture we can now move on to the next lecture
[11:05] Thank you.
