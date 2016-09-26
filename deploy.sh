export AWS_PROJECT=agconmid

##### Create the security group pour ouvrir certain port du docker host. Au moins SSH 22 + Docker command 2376
aws ec2 create-security-group --group-name docksg$AWS_PROJECT --description dock-security-group-$AWS_PROJECT --vpc-id vpc-49249a2e
//On cible un vpc en particulier(celui du mongo), on doit donc créer les règles dans celui-ci
export AWS_SG_ID=`aws ec2 describe-security-groups --filters "Name=group-name,Values=docksg$AWS_PROJECT" --output text --query 'SecurityGroups[0].GroupId'`
aws ec2 authorize-security-group-ingress --protocol tcp --port 22 --cidr 0.0.0.0/0 --group-id $AWS_SG_ID
aws ec2 authorize-security-group-ingress --protocol tcp --port 2376 --cidr 0.0.0.0/0 --group-id $AWS_SG_ID

//On creé le docker host dans le même vpc que le mongo-db
docker-machine create --driver amazonec2 \
--amazonec2-region us-east-1 \
--amazonec2-zone c \
--amazonec2-vpc-id vpc-49249a2e \
--amazonec2-security-group docksg$AWS_PROJECT \
--amazonec2-tags project:$AWS_PROJECT dockinstance$AWS_PROJECT

#### definit le variables d'env pour definir ce docker host par default
#### a partir de ce moment les commandes docker et docker-compose vont s'executer sur le docker host créer chez aws
eval $(docker-machine env dockinstance$AWS_PROJECT)

################ Autorisation depuis l'agence
aws ec2 authorize-security-group-ingress --group-id $AWS_SG_ID --protocol tcp --port 80 --cidr 193.27.69.129/32
aws ec2 authorize-security-group-ingress --group-id $AWS_SG_ID --protocol tcp --port 5672 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $AWS_SG_ID --protocol tcp --port 8080 --cidr 193.27.69.129/32

//Autorise l'accès a mongo depuis agcon-mid
aws ec2 authorize-security-group-ingress --group-id sg-ed7c3496 --protocol tcp --port 27017 --source-group $AWS_SG_ID

docker-compose up -d --build

#docker-machine ls
#docker ps -a
#docker logs agconmid_web_1
#docker logs agconmid_apollo_1
#docker-machine regenerate-certs dockinstanceagconmid
#docker exec -i -t agconmid_web_1 /bin/bash
