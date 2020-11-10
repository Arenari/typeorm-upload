import csvParse from 'csv-parse';
import fs from 'fs';
import Category from '../models/Category';
import Transaction from '../models/Transaction';
import { getCustomRepository, getRepository, In } from 'typeorm';
import CreateTransactionService from './CreateTransactionService';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  filepath: string;
}

interface CSVLine {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  categoryTitle: string;
}
class ImportTransactionsService {
  async execute({ filepath }: Request): Promise<Transaction[]> {
    const lines = await this.loadCSV(filepath);
    const categoriesRepository = getRepository(Category);
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const categories = lines.reduce(
      (acc, line) => acc.add(line.categoryTitle),
      new Set<string>(),
    );

    const existingCategories = await categoriesRepository.find({
      where: {
        title: In(Array.from(categories)),
      },
    });

    const existingCategoriesByName = existingCategories.reduce(
      (map, category) => map.set(category.title, category),
      new Map<string, Category>(),
    );

    const categoriesToCreate = Array.from(categories)
      .filter(category => !existingCategoriesByName.has(category))
      .map(category => categoriesRepository.create({ title: category }));

    await categoriesRepository.save(categoriesToCreate);

    const transactions = lines.map(line => {
      const { title, type, value, categoryTitle } = line;
      const category = existingCategoriesByName.has(categoryTitle)
        ? existingCategoriesByName.get(categoryTitle)
        : categoriesToCreate.find(
            categoryCreated => categoryCreated.title === categoryTitle,
          );
      const transaction = transactionsRepository.create({
        title,
        category,
        value,
        type,
      });
      return transaction;
    });

    await transactionsRepository.save(transactions);
    await fs.promises.unlink(filepath);
    return Promise.all(transactions);
  }

  async loadCSV(filePath: string): Promise<CSVLine[]> {
    const readCSVStream = fs.createReadStream(filePath);
    const parseStream = csvParse({
      from_line: 2,
      ltrim: true,
      rtrim: true,
    });

    const parseCSV = readCSVStream.pipe(parseStream);

    const lines: CSVLine[] = [];

    parseCSV.on('data', line => {
      const [title, type, value, categoryTitle] = line;
      lines.push({ title, type, value, categoryTitle });
    });

    await new Promise(resolve => {
      parseCSV.on('end', resolve);
    });

    return lines;
  }
}

export default ImportTransactionsService;
